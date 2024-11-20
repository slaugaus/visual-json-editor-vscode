import * as vscode from "vscode";
import { Disposable } from "./disposal";
import { JsonDocumentDelegate } from "./helpers";
import { editorSubTypes, editorTypes, JsonEdit, OutputHTML, SomethingFromJson } from "../common";
import { HTMLElement, parse as parseHtml } from "node-html-parser";
import { LosslessNumber, parse as parseJson, stringify } from "lossless-json";

/**
 * Handles loading and saving the JSON file, including serialization.
 */
export class JsonDocument extends Disposable implements vscode.CustomDocument {

    /**
     * Create a new instance from a URI.
     * @param delegate Function getData (within object) that returns the HTML containing
     *      this document's updated data. Implemented in JsonEditorProvider since it has 
     *      access to the webviews and I don't.
     */
    static async create(uri: vscode.Uri, backupId: string | undefined, delegate: JsonDocumentDelegate)
        : Promise<JsonDocument | PromiseLike<JsonDocument>> {
        // Read the backup if it exists, otherwise get the file at uri
        const actualUri = typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;

        if (typeof backupId === "string") {
            console.log(`Loaded a backup from ${backupId}`);
        }

        const fileObj = await this._readFile(actualUri);
        return new JsonDocument(uri, fileObj, delegate);
    }

    public get uri() { return this._uri; }

    public get object(): any { return this._object; }



    private constructor(
        private readonly _uri: vscode.Uri,
        private _object: any,
        private readonly _delegate: JsonDocumentDelegate
    ) {
        super();
    }

    private _freshEdits: JsonEdit[] = [];
    private _savedEdits: JsonEdit[] = [];

    //#region Editing

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
        readonly content?: any;
        // readonly edits: readonly JsonEdit[];
    }>());

    /** Fired to notify webviews of a change to the document. */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;


    private readonly _onDidChange = this._register(new vscode.EventEmitter<{
        readonly label: string;
        undo(): void;
        redo(): void;
    }>());

    /** 
     * Fired to tell VS Code that an edit happened, and how to un/redo it.
     * 
     * This gives tabs the "dirty indicator" (dot).
     */
    public readonly onDidChange = this._onDidChange.event;

    /**
     * Call when an edit is made in the webview.
     * @todo Doesn't do anything to the object. Does it need to?
     */
    makeEdit(edit: JsonEdit) {
        this._freshEdits.push(edit);

        // Tell VS Code about the edit
        this._onDidChange.fire({
            label: edit.type,
            undo: async () => {
                // On undo, send open editors the list of edits minus the undone one
                this._freshEdits.pop();
                this._onDidChangeDocument.fire({
                    content: this._playbackEdits(this._freshEdits)
                    // edits: this._freshEdits,
                });
            },
            redo: async () => {
                // On redo, send open editors the new list of edits
                this._freshEdits.push(edit);
                this._onDidChangeDocument.fire({
                    content: this._playbackEdits(this._freshEdits)
                    // edits: this._freshEdits,
                });
            },
        });
    }

    /**
     * Return the object with a list of edits applied to it.
     */
    private _playbackEdits(edits: JsonEdit[]): any {
        console.log("PLAYING BACK EDITS...");

        const obj = structuredClone(this._object);

        edits.forEach(edit => {
            // TODO this whole thing is crusty
            JsonDocument._navigateThen(obj, edit.path, (finalObj, finalKey) => {
                switch (edit.type) {
                    case "contents":
                        console.log(`  CONTENTS - [${edit.path.join(", ")}] -> ${edit.change}`);
                        finalObj[finalKey] = edit.change;
                        break;
                    case "add":
                        console.log(`  ADD - [${edit.path.join(", ")}] -> ${edit.change}`);
                        finalObj[finalKey] = edit.change.value;
                        break;
                    case "delete":
                        console.log(`  DELETE - [${edit.path.join(", ")}] -> ${edit.change}`);
                        delete finalObj[finalKey];
                        break;
                    case "rename":
                        console.log(`  RENAME - [${edit.path.join(", ")}] -> ${edit.change}`);
                        finalObj[edit.change] = finalObj[finalKey];
                        delete finalObj[finalKey];
                        break;
                    case "swap":
                        // TODO
                        console.log(`  SWAP - [${edit.path.join(", ")}] -> ${edit.change}`);
                        break;
                }
            });
        });

        console.log("END EDIT PLAYBACK\n");
        return obj;
    }

    /**
     * Navigate to the second-to-last object in path, then pass it and the last part of
     * path to the callback function to do whatever you want.
     * @param object 
     * @param path 
     * @param callback 
     */
    private static _navigateThen(object: any, path: string[],
        callback: (finalObj: any, finalKey: string) => void
    ) {
        let pointer = object;

        for (let i = 0; i < path.length - 1; i++) {
            if (pointer[path[i]]) {
                pointer = pointer[path[i]];
            }
        }

        callback(pointer, path[path.length - 1]);
    }

    //#endregion

    //#region File I/O

    /**
     * Attempt to parse the file at (uri) as JSON. Return the object if successful.
     */
    private static async _readFile(uri: vscode.Uri): Promise<any> {
        if (uri.scheme === "untitled") {
            return {};
        }

        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
        const text: string = doc.getText();

        // Don't throw parsing errors if file is nothing or whitespace
        if (/^\s*$/.test(text)) {
            return {};
        }

        let jsonObject;
        try {
            jsonObject = parseJson(text);
        }
        // TODO: (QOL) Dump all problems with the JSON? + Signal to open a plaintext editor
        //  - Or start as the "paste JSON here" editor
        catch (e) {
            if (e instanceof SyntaxError) {
                vscode.window.showErrorMessage(`File is not valid JSON: ${e.message}`);
            }
            else if (e instanceof Error) {
                vscode.window.showErrorMessage(`Error parsing file. ${e.name}: ${e.message}`);
            }
            return {};
        }

        return jsonObject;
    }

    async save(cancellation: vscode.CancellationToken) {
        await this.saveAs(this._uri, cancellation);
        this._savedEdits = Array.from(this._freshEdits);  // (copy)
    }

    async saveAs(uri: vscode.Uri, cancellation: vscode.CancellationToken) {

        const data = await this._delegate.getData();

        const dataObject = JsonDocument._readHtml(data);

        // Avoid data loss - catch readHtml returning empty
        if (data.html.length > 0) {
            if ((data.type === "array" && dataObject.length === 0)
                || (data.type === "object" && Object.keys(dataObject).length === 0)) {
                vscode.window.showErrorMessage(`Save failed! Got an empty ${data.type} even though there should be content.`);
                cancellation.isCancellationRequested = true;
                return;
            }
        }

        // Read from settings (defaults to 2 as defined in package.json)
        const prettiness = vscode.workspace.getConfiguration("visual-json")
            .get<number>("outputPrettiness");

        const stringified = stringify(dataObject, null, prettiness);

        // fs.writeFile requires a Uint8Array
        const encoded: Uint8Array = new TextEncoder().encode(stringified);

        if (cancellation.isCancellationRequested) { return; }

        vscode.workspace.fs.writeFile(uri, encoded);
    }

    /** Revert to the state of the file at its last save */
    async revert(cancellation: vscode.CancellationToken): Promise<void> {
        const fileOnDisk = JsonDocument._readFile(this.uri);
        if (cancellation.isCancellationRequested) { return; }
        this._object = fileOnDisk;
        this._freshEdits = this._savedEdits;
        this._onDidChangeDocument.fire({
            content: await fileOnDisk,
            // edits: this._freshEdits,
        });
    }

    /** Called by VS Code if it needs to save a backup. */
    async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken)
        : Promise<vscode.CustomDocumentBackup> {
        await this.saveAs(destination, cancellation);
        return {
            id: destination.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(destination);
                } catch {
                    // ignore errors; we don't care whether the delete worked
                }
            }
        };
    }

    //#endregion

    //#region HTML -> Object Logic

    /**
     * Entrypoint for parsing HTML from the editor.
     * @param data Contents of #jsonContainer
     * @returns A JSON-serializable object
     */
    private static _readHtml(data: OutputHTML): any {
        const container = parseHtml(data.html);

        let outputObject;
        // Handle base object being an array
        if (data.type === "array") { outputObject = []; }
        else { outputObject = {}; }

        for (const child of container.childNodes) {
            this._addFromNode(child as HTMLElement, outputObject);
        }

        return outputObject;
    }

    /**
     * Given child (the value as a <details> key/value pair), extract the key+value
     * and add them to parent (possibly recurring to do it fully).
     */
    private static _addFromNode(child: HTMLElement, parent: any) {
        const keyElement = child.querySelector(".key")!;
        const valElement = child.querySelector(".value")!;

        const childKey: string = keyElement.querySelector(".name")?.textContent!;
        let childValue: SomethingFromJson;

        // TODO: Detect and ignore (or fill in?) incomplete elements

        let type = this._getTypeOfElement(child);
        type = editorSubTypes[type] ?? type;    // Get base type

        switch (type) {
            case "string":
                childValue = valElement.textContent;
                break;
            case "number":
                childValue = new LosslessNumber(valElement.textContent ?? "0");
                break;
            case "boolean":
                childValue = valElement.textContent === "true";
                break;
            case "null":
                childValue = null;
                break;
            case "object":
                childValue = {};
                for (const grandchild of valElement.childNodes) {
                    this._addFromNode(grandchild as HTMLElement, childValue);
                }
                break;
            case "array":
                childValue = [];
                for (const grandchild of valElement.childNodes) {
                    this._addFromNode(grandchild as HTMLElement, childValue);
                }
                break;
            default:
                throw new TypeError(`Tried to save unknown type: ${type}`);
        }

        // Fun fact: Arrays can be indexed by strings of ints!
        // (It doesn't matter that parent: Array is having its "0" set)
        parent[childKey] = childValue!;
    }

    /**
     * Read ele.classList and return the type it contains.
     * 
     * Theoretically the type will always be class #2, but don't make that assumption.
     */
    private static _getTypeOfElement(ele: HTMLElement): string {
        const result = ele.classList.value.filter(
            val => editorTypes.includes(val));

        if (result.length > 1) {
            vscode.window.showErrorMessage(`Element ${ele.outerHTML} has multiple types (${result})! Returning the first one.`);
        }
        return result[0];
    }

    //#endregion

    //#region Disposal

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    public readonly onDidDispose = this._onDidDispose.event;

    dispose(): void {
        this._onDidDispose.fire();
        super.dispose();
    }

    //#endregion
}
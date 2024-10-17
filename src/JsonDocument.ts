import * as vscode from "vscode";
import { Disposable } from "./disposal";
import { JsonDocumentDelegate, JsonEdit, OutputHTML } from "./helperTypes";
import { HTMLElement, parse } from "node-html-parser";

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
        const actualUri = typeof(backupId) === "string" ? vscode.Uri.parse(backupId) : uri;

        if (typeof(backupId) === "string") {
            console.log(`Loaded a backup from ${backupId}`);
        }

        const fileObj = await this.readFile(actualUri);
        return new JsonDocument(uri, fileObj, delegate);
    }

    private constructor(uri: vscode.Uri, fileObj: any, delegate: JsonDocumentDelegate) {
        super();
        this._uri = uri;
        this._object = fileObj;
        this._delegate = delegate;
    }

    private readonly _uri: vscode.Uri;
    private _object: any;
    private _freshEdits: JsonEdit[] = [];
    private _savedEdits: JsonEdit[] = [];

    private readonly _delegate: JsonDocumentDelegate;

    public get uri() { return this._uri; }

    public get object(): any { return this._object; }

    //#region Editing

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
        readonly content?: any;
        readonly edits: readonly JsonEdit[];
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
                    edits: this._freshEdits,
                });
            },
            redo: async () => {
                // On redo, send open editors the new list of edits
                this._freshEdits.push(edit);
                this._onDidChangeDocument.fire({
                    edits: this._freshEdits,
                });
            },
        });
    }

    //#endregion

    //#region File I/O

    /**
     * Attempt to parse the file at (uri) as JSON. Return the object if successful.
     */
    private static async readFile(uri: vscode.Uri): Promise<any> {
        if (uri.scheme === "untitled") {
            return {};
        }

        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
        const text: string = doc.getText();

        let jsonObject;
        try {
            jsonObject = JSON.parse(text);
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

        const dataObject = JsonDocument.readHtml(data);

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

        const stringified = JSON.stringify(dataObject, null, prettiness);

        // fs.writeFile requires a Uint8Array
        const encoded: Uint8Array = new TextEncoder().encode(stringified);

        if (cancellation.isCancellationRequested) { return; }

        vscode.workspace.fs.writeFile(uri, encoded);
    }

    /** Revert to the state of the file at its last save */
    async revert(cancellation: vscode.CancellationToken): Promise<void> {
        const fileOnDisk = JsonDocument.readFile(this.uri);
        if (cancellation.isCancellationRequested) { return; }
        this._object = fileOnDisk;
        this._freshEdits = this._savedEdits;
        this._onDidChangeDocument.fire({
            content: fileOnDisk,
            edits: this._freshEdits,
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
                    // ignore errors
                }
            }
        };
    }

    //#endregion

    //#region HTML -> Object Logic

    private static readHtml(data: OutputHTML): any {
        const container = parse(data.html);

        let outputObject;
        // Handle base object being an array
        if (data.type === "array") { outputObject = []; }
        else { outputObject = {}; }

        for (const child of container.childNodes) {
            this.addFromNode(child as HTMLElement, outputObject);
        }

        return outputObject;
    }

    /**
     * Given child (the value as a <details> key/value pair), extract the key+value
     * and add them to parent (possibly recurring to do it fully).
     */
    private static addFromNode(child: HTMLElement, parent: any) {
        const keyElement = child.querySelector(".key")!;
        const valElement = child.querySelector(".value")!;

        const childKey: string = keyElement.querySelector(".name")?.textContent!;
        let childValue: any;

        // TODO: Detect and ignore (or fill in?) incomplete elements

        switch (this.getTypeOfElement(child)) {
            case "string":
                childValue = valElement.textContent;
                break;
            case "number":
                childValue = parseFloat(valElement.textContent!);
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
                    this.addFromNode(grandchild as HTMLElement, childValue);
                }
                break;
            case "array":
                childValue = [];
                for (const grandchild of valElement.childNodes) {
                    this.addFromNode(grandchild as HTMLElement, childValue);
                }
                break;
        }

        // Fun fact: Arrays can be indexed by strings of ints!
        // (It doesn't matter that parent: Array is having its "0" set)
        parent[childKey] = childValue;
    }

    private static readonly _validBaseTypes = [
        "string",
        "number",
        "boolean",
        "null",
        "array",
        "object"
    ];

    // Read ele.classList and return the JSON type it contains
    // Theoretically the type will always be class #2, but don't make that assumption
    private static getTypeOfElement(ele: HTMLElement): string {
        // Get the class(es) that indicate type
        const result = ele.classList.value.filter(val => this._validBaseTypes.includes(val));

        if (result.length > 1) {
            vscode.window.showErrorMessage(`Element ${ele.outerHTML} has multiple base types (${result})! Returning the first one.`);
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
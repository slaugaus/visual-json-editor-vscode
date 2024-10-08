import * as vscode from "vscode";
import { Disposable } from "./dispose";
import { JsonDocumentDelegate, OutputHTML } from "./helperTypes";
import { HTMLElement, parse } from "node-html-parser";

/**
 * Handles loading and saving the JSON file, including serialization.
 * TODO: Not very well, though.
 */
export class JsonDocument extends Disposable implements vscode.CustomDocument {

    /**
     * Create a new instance from a URI.
     * @param delegate Function getData (within object) that returns the HTML containing
     *      this document's updated data. Implemented in JsonEditorProvider since it has 
     *      access to the webviews and I don't.
     */
    static async create(uri: vscode.Uri, delegate: JsonDocumentDelegate)
        : Promise<JsonDocument | PromiseLike<JsonDocument>> {
        const fileObj = await this.readFile(uri);
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
    private _delegate: JsonDocumentDelegate;

    public get uri() { return this._uri; }

    public get object(): any { return this._object; }

    async save(cancellation: vscode.CancellationToken) {
        await this.saveAs(this._uri, cancellation);
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
    
        // TODO: (CONFIG) Setting for how pretty saved JSON is
        const stringified = JSON.stringify(dataObject, null, 2);
        const encoded: Uint8Array = new TextEncoder().encode(stringified);
        if (cancellation.isCancellationRequested) {
            return;
        }
        vscode.workspace.fs.writeFile(uri, encoded);
    }

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
        // TODO: (QOL) Dump all problems with the JSON? + Signal to open plaintext editor
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
}
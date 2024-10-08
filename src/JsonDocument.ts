import * as vscode from "vscode";
import { Disposable } from "./dispose";

/**
 * Handles loading and saving the JSON file, including serialization.
 * TODO: Not very well, though.
 */
export class JsonDocument extends Disposable implements vscode.CustomDocument {

    static async create(uri: vscode.Uri)
    : Promise<JsonDocument | PromiseLike<JsonDocument>> {
        const fileObj = await this.readFile(uri);
        return new JsonDocument(uri, fileObj);
    }

    private constructor(uri: vscode.Uri, fileObj: any) {
        super();
        this._uri = uri;
        this._object = fileObj;
    }

    private readonly _uri: vscode.Uri;
    private _object: any;

    public get uri() { return this._uri; }

    public get object(): any { return this._object; }

    async save(toSave: any, cancellation: vscode.CancellationToken) {
        await this.saveAs(toSave, this._uri, cancellation);
    }

    async saveAs(toSave: any, uri: vscode.Uri, cancellation: vscode.CancellationToken) {
        const stringified = JSON.stringify(toSave, null, 2);
        const encoded: Uint8Array = new TextEncoder().encode(stringified);
        if (cancellation.isCancellationRequested) {
            return;
        }
        vscode.workspace.fs.writeFile(uri, encoded);
    }

    /**
     * Attempt to parse the file at (uri) as JSON. Return the object if successful.
     * @param uri 
     * @returns 
     */
    private static async readFile(uri: vscode.Uri): Promise<any> {
        if (uri.scheme === "untitled") {
            return {};
        }

        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
        const text: string = doc.getText();

        var jsonObject;
        try {
            jsonObject = JSON.parse(text);
        }
        // TODO: (QOL) Dump all problems with the JSON? + Signal to open plaintext editor
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
}
import * as vscode from "vscode";
import { Disposable, disposeAll } from './dispose';
import { JsonDocument } from "./JsonDocument";
import { Message, WebviewCollection } from "./helperTypes";
import { randomBytes } from "crypto";

export class JsonEditorProvider implements vscode.CustomEditorProvider{

    // _context is actually accessible just by doing this
    constructor(private readonly _context: vscode.ExtensionContext) {}

    /** Name/ID of the custom editor - reference this in commands that open it */
    private static readonly viewType = "visual-json.mainEditor";

    static register(context: vscode.ExtensionContext) {
        // Register any commands here

        return vscode.window.registerCustomEditorProvider(
            JsonEditorProvider.viewType,
            new JsonEditorProvider(context),
            // Add'l options object
            {
                /**
                 * This option keeps editor webviews "alive" when they're not visible.
                 * It uses extra RAM, but is necessary to preserve the document
                 * (which is currently stored in/as the UI).
                 * @todo: Look for a way to let this be false?
                 */
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            });
    }

    /** Tracks all webviews (editors) the extension has open. */
    private readonly webviews = new WebviewCollection();

    //#region CustomEditorProvider Implementation

    // Called the first time a file is opened in the editor.
    // (Opening more editors for the same file reuses the same JsonDocument)
    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): Promise<JsonDocument> {
        const document: JsonDocument = await JsonDocument.create(uri);

        // TODO: If you give JsonDocument events, register them here

        return document;
    }

    // Called whenever a new custom editor is opened.
    async resolveCustomEditor(
        document: JsonDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Add the webview to our internal set of active webviews
        this.webviews.add(document.uri, webviewPanel);

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.buildViewHtml(webviewPanel.webview);

        // Subscribe to messages from this webview
        webviewPanel.webview.onDidReceiveMessage(e => this.onGetMessage(document, e));

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                if (document.uri.scheme === 'untitled') {
                    // Handle any setup necessary for new documents (probably none?)
                } else {
                    this.sendMessage(webviewPanel, {type: "doc", body: document.object});
                }
            }
        });
    }

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<JsonDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public saveCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        // TODO: Tell webview to serialize, or dump #jsonContainer

        if (document.uri.scheme !== 'untitled'){
            vscode.window.showErrorMessage("Saving is not implemented yet - canceling.");
            cancellation.isCancellationRequested = true;
        }

        return document.save({}, cancellation);
    }

    public saveCustomDocumentAs(document: JsonDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        if (document.uri.scheme !== 'untitled'){
            vscode.window.showErrorMessage("Saving As is not implemented yet - canceling.");
            cancellation.isCancellationRequested = true;
        }

        return document.saveAs({}, destination, cancellation);
    }

    public revertCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error("Not implemented");
        // return document.revert(cancellation);
    }

    public backupCustomDocument(document: JsonDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
        throw new Error("Not implemented");
        // return document.backup(context.destination, cancellation);
    }

    //#endregion

    //#region Messaging

    private sendMessage(panel: vscode.WebviewPanel, message: Message): void {
        panel.webview.postMessage(message);
    }

    private onGetMessage(document: JsonDocument, message: Message): void {
        switch(message.type){
            case "ping":
                vscode.window.showInformationMessage("Polo!");
                break;
            case "ready": break;
            default:
                vscode.window.showErrorMessage(`What am I supposed to do with a ${message.type}?!`);
                break;
        }
    }

    //#endregion

    /**
     * Returns the static HTML for the webview.
     */
    private buildViewHtml(view: vscode.Webview): string {
        // Get paths to CSS/JS (media folder) that the webview can reach
        const scriptUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "media", "editor.js"));

        const styleUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "media", "programmerArt.css"));

        // "Number Used Once" for preventing script injection
        const nonce = randomBytes(32).toString("base64");

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!-- Allow only images from HTTPS or the media dir, styles from the media dir,
                and scripts with a certain nonce -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.cspSource} blob:; style-src ${view.cspSource}; script-src 'nonce-${nonce}';">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>JSON Editor</title>

                <link rel="stylesheet" href="${styleUri}"> 
                <script defer src="${scriptUri}" nonce="${nonce}"></script>
            </head>
            <body>
                <button type="button" id="ping">Marco!</button>
                <div id="jsonContainer">Something went wrong :(</div>
            </body>
            </html>
        `;
    }
}
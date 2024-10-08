import * as vscode from "vscode";
import { Disposable, disposeAll } from './dispose';
import { JsonDocument } from "./JsonDocument";
import { IDMessage, Message, WebviewCollection } from "./helperTypes";
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
                 * @todo: Look for a way to let this be false? (Something about state in view's code)
                 */
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                // TODO: (STRETCH/QOL) Look into syncing state between editors
                //  - Remove error check in getDataHtml()
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
        const document = await JsonDocument.create(uri, {
            // Implement retrieving data from the webview here, as JsonDocument
            // doesn't get to access it.
            getDataHtml: async () => {
                const webviewsForThisDoc = Array.from(this.webviews.get(document.uri));
                if (webviewsForThisDoc.length === 0) {
                    throw new Error("Could not find a webview for this document");
                }
                else if (webviewsForThisDoc.length > 1) {
                    throw new Error("Doc is somehow open in multiple tabs...");
                }
                return await this.sendMessageWithResponse<string>(webviewsForThisDoc[0], {
                    type: "getDataHtml",
                    body: null
                });
            }
        });

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
                    this.sendMessage(webviewPanel, {
                        type: "doc", body: document.object
                    });
                }
            }
        });
    }

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<JsonDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public saveCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {

        // if (document.uri.scheme !== 'untitled'){
        //     vscode.window.showErrorMessage("Saving is not implemented yet - canceling.");
        //     cancellation.isCancellationRequested = true;
        // }

        return document.save(cancellation);
    }

    public saveCustomDocumentAs(document: JsonDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        // if (document.uri.scheme !== 'untitled'){
        //     vscode.window.showErrorMessage("Saving As is not implemented yet - canceling.");
        //     cancellation.isCancellationRequested = true;
        // }

        return document.saveAs(destination, cancellation);
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

    private _requestId = 1;
    private readonly _callbacks = new Map<number, (response: any) => void>();

    /** Send a message to panel expecting a response (the Promise returned). */
    private sendMessageWithResponse<R = unknown>(
        panel: vscode.WebviewPanel,
        message: Message
    ): Promise<R> {
        const requestId = this._requestId++;
        // When this promise is resolved, add the result to _callbacks
        const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
        // Send the message
		panel.webview.postMessage({ type: message.type, requestId, body: message.body });
		return p;
    }

    private onGetMessage(document: JsonDocument, message: Message | IDMessage): void {
        switch(message.type){
            case "ping":
                vscode.window.showInformationMessage("Polo!");
                return;

            case "responseReady":
                const callback = this._callbacks.get((message as IDMessage).requestId);
                callback?.(message.body);
                return;

            case "ready": return;
            default:
                vscode.window.showErrorMessage(`What am I supposed to do with a ${message.type}?!`);
                return;
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
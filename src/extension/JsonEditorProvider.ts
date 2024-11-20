import * as vscode from "vscode";
import { Disposable, disposeAll } from './disposal';
import { JsonDocument } from "./JsonDocument";
import { WebviewCollection } from "./helpers";
import { randomBytes } from "crypto";
import { OutputHTML, Message } from "../common";

export class JsonEditorProvider implements vscode.CustomEditorProvider {

    // _context is actually accessible just by doing this
    constructor(private readonly _context: vscode.ExtensionContext) { }

    /** Name/ID of the custom editor - reference this in commands that open it */
    private static readonly _viewType = "visual-json.mainEditor";

    static register(context: vscode.ExtensionContext) {
        // Register any commands here

        return vscode.window.registerCustomEditorProvider(
            JsonEditorProvider._viewType,
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
                //  - Remove error check in getData()
                supportsMultipleEditorsPerDocument: false,
            });
    }

    /** Tracks all webviews (editors) the extension has open. */
    private readonly _webviews = new WebviewCollection();

    //#region CustomEditorProvider Implementation

    // Called the first time a file is opened in the editor.
    // (Opening more editors for the same file reuses the same JsonDocument)
    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): Promise<JsonDocument> {
        const document = await JsonDocument.create(uri, openContext.backupId, {
            // Implement retrieving data from the webview here, as JsonDocument
            // doesn't get to access it. Hooray for delegates!
            getData: async () => {
                const webviewsForThisDoc = Array.from(this._webviews.get(document.uri));
                if (webviewsForThisDoc.length === 0) {
                    throw new Error("Could not find a webview for this document");
                }
                else if (webviewsForThisDoc.length > 1) {
                    throw new Error("Doc is somehow open in multiple tabs...");
                }
                return await this._sendMessageWithResponse<OutputHTML>(webviewsForThisDoc[0], {
                    type: "getData",
                    body: null
                });
            }
        });

        const docListeners: vscode.Disposable[] = [];

        // Event telling VS Code that edits were made
        docListeners.push(document.onDidChange(event => {
            this._onDidChangeCustomDocument.fire({
                document,
                ...event    // remaining items = contents of event
            });
        }));

        // Event telling all the webviews that the document changed
        docListeners.push(document.onDidChangeContent(event => {
            for (const panel of this._webviews.get(document.uri)) {
                this._sendMessage(panel, {
                    type: "change",
                    body: event
                });
            }
        }));

        // Dispose these while disposing the document
        document.onDidDispose(() => { disposeAll(docListeners); });

        return document;
    }

    // Called whenever a new custom editor is opened.
    async resolveCustomEditor(
        document: JsonDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Add the webview to our internal set of active webviews
        this._webviews.add(document.uri, webviewPanel);

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this._buildViewHtml(webviewPanel.webview);

        // Subscribe to messages from this webview
        webviewPanel.webview.onDidReceiveMessage(event => this._onGetMessage(document, event));

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(event => {
            if (event.type === 'ready') {
                if (document.uri.scheme === 'untitled') {
                    // Handle any setup necessary for new documents (probably none?)
                } else {
                    this._sendMessage(webviewPanel, {
                        type: "doc", body: document.object
                    });
                }
            }
        });
    }

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<JsonDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public saveCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        const save = document.save(cancellation);
        this._sendMessageAll(document, { type: "saved" });
        return save;
    }

    public saveCustomDocumentAs(document: JsonDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        const saveAs = document.saveAs(destination, cancellation);
        this._sendMessageAll(document, { type: "saved" });
        return saveAs;
    }

    public revertCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.revert(cancellation);
    }

    public backupCustomDocument(document: JsonDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
        return document.backup(context.destination, cancellation);
    }

    //#endregion

    //#region Messaging

    private _sendMessage(panel: vscode.WebviewPanel, message: Message<any>): void {
        panel.webview.postMessage(message);
    }

    /** Message all webviews belonging to a JsonDocument */
    private _sendMessageAll(document: JsonDocument, message: Message<any>): void {
        for (const panel of this._webviews.get(document.uri)) {
            panel.webview.postMessage(message);
        }
    }

    private _requestId = 1;
    private readonly _callbacks = new Map<number, (response: any) => void>();

    /** Send a message to panel expecting a response (the Promise returned). */
    private _sendMessageWithResponse<R = unknown>(
        panel: vscode.WebviewPanel,
        message: Message<R | null>
    ): Promise<R> {
        const requestId = this._requestId++;
        // When this promise is resolved, add the result to _callbacks
        const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
        // Send the message
        panel.webview.postMessage({ type: message.type, requestId, body: message.body });
        return p;
    }

    private _onGetMessage(document: JsonDocument, message: Message<any>): void {
        switch (message.type) {

            case "responseReady":
                const callback = this._callbacks.get(message.requestId as number);
                callback?.(message.body);
                return;

            case "ready": return;

            case "edit":
                document.makeEdit(message.body);
                return;

            case "debug":
                vscode.window.showInformationMessage(message.body);
                console.log(message.body);
                return;

            case "error":
                vscode.window.showErrorMessage(message.body);
                console.error(message.body);
                return;

            default:
                vscode.window.showErrorMessage(`What am I supposed to do with a ${message.type}?!`);
                return;
        }
    }

    //#endregion

    /**
     * Returns the static HTML for the webview.
     */
    private _buildViewHtml(view: vscode.Webview): string {
        // Get paths to CSS/JS (media folder) that the webview can reach
        const scriptUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "media", "editor.js"));

        // TODO: Swap this with vscode.css eventually
        const styleUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "media", "programmerArt.css"));

        const codiconsUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"));

        const layoutUri = view.asWebviewUri(vscode.Uri.joinPath(
            this._context.extensionUri, "media", "layoutStuff.css"));

        // "Number Used Once" for preventing script injection
        const nonce = randomBytes(32).toString("base64");

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!-- Allow only images from HTTPS or this extension, styles and fonts from this extension,
                    and scripts with a certain nonce -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.cspSource} blob:; style-src ${view.cspSource}; font-src ${view.cspSource}; script-src 'nonce-${nonce}';">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>JSON Editor</title>

                <link rel="stylesheet" href="${styleUri}"> 
                <link rel="stylesheet" href="${codiconsUri}">
                <link rel="stylesheet" href="${layoutUri}">
                <script defer src="${scriptUri}" nonce="${nonce}"></script>
            </head>
            <body>
                <div id="jsonContainer"></div>
                <button type="button" id="rootPlus">
                    <i class="codicon codicon-plus"></i> New Item
                </button>
            </body>
            </html>
        `;
    }
}
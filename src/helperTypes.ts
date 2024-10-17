import * as vscode from "vscode";

// TODO: extend this when messaging system is better defined?
// (a string literal can be a type)
/**  */
export type Message<T> = {
    type: string,
    requestId?: number,
    body?: T
};

export type OutputHTML = {
    type: "object" | "array",
    html: string
}

export interface JsonDocumentDelegate {
    getData(): Promise<OutputHTML>;
}

export interface JsonEdit {
    readonly path: string[],
    readonly type: "contents" | "add" | "delete" | "rename",
    readonly change: any,
}

/**
 * Wrapper for a Set that tracks all of the extension's webviews.
 * 
 * (From Custom Editor Sample)
 */
export class WebviewCollection {

    private readonly _webviews = new Set<{
        readonly resource: string;
        readonly webviewPanel: vscode.WebviewPanel;
    }>();

    /**
     * Get all known webviews for a given URI.
     */
    public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
        const key = uri.toString();
        for (const entry of this._webviews) {
            if (entry.resource === key) {
                yield entry.webviewPanel;
            }
        }
    }

    /**
     * Add a new webview to the collection.
     */
    public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
        const entry = { resource: uri.toString(), webviewPanel };
        this._webviews.add(entry);

        webviewPanel.onDidDispose(() => {
            this._webviews.delete(entry);
        });
    }
}
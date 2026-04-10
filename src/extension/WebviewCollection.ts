import type vscode from 'vscode';

/**
 * Wrapper for a Set that tracks all of the extension's webviews.
 *
 * (From Custom Editor Sample)
 */
export default class WebviewCollection {
	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Gets all known webviews for a given URI.
	 *
	 * @param uri A URI.
	 * @yields All known webviews for a given URI.
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
	 * Adds a new webview to the collection.
	 *
	 * @param uri A URI.
	 * @param webviewPanel The webview to add.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}

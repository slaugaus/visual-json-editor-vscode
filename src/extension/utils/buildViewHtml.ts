import { randomBytes } from 'node:crypto';

import vscode from 'vscode';

/**
 * Builds the static HTML for a webview.
 *
 * @param view The webview being created.
 * @param extensionUri `vscode.ExtensionContext.extensionUri`
 * @returns An HTML page.
 * @todo Solid SSR?????
 */
export default function buildViewHtml(
	view: vscode.Webview,
	extensionUri: vscode.Uri,
): string {
	const pathOf = (...parts: string[]) =>
		view.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...parts)).toString();

	const script = pathOf('dist', 'editor.js');
	const codicons = pathOf('dist', 'codicon.css');
	const style = pathOf('media', 'vscode.css');
	const layout = pathOf('media', 'layout.css');

	// "Number Used Once" for preventing script injection
	const nonce = randomBytes(32).toString('base64');

	return `
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!-- Allow only images from HTTPS or this extension, styles and fonts from this extension,
					and scripts with a certain nonce -->
				<meta http-equiv="Content-Security-Policy"
					content="default-src 'none'; img-src ${view.cspSource} blob:; style-src ${view.cspSource}; font-src ${view.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>JSON Editor</title>

				<link rel="stylesheet" href="${style}"> 
				<link rel="stylesheet" href="${codicons}">
				<link rel="stylesheet" href="${layout}">
				<script defer src="${script}" nonce="${nonce}"></script>
			</head>
			<body>
				<div id="jsonContainer"></div>
				<button type="button" id="rootPlus">
					<i class="codicon codicon-plus"></i> New Item
				</button>
				<!-- TODO: restore this when you resume solid dev
				<div class="split">
					<div id="jsonContainerNew"></div>
					<div>
						<div id="jsonContainer"></div>
						<button type="button" id="rootPlus">
							<i class="codicon codicon-plus"></i> New Item
						</button>
					</div>
				</div> -->
			</body>
		</html>
		`;
}

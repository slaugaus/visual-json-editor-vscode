// oxlint-disable solid/reactivity
import { randomBytes } from 'node:crypto';

import { renderToString } from 'solid-js/web';
import { Uri } from 'vscode';
import type { Webview } from 'vscode';

type WebviewHtmlProps = { view: Webview; extensionUri: Uri };

/**
 * Solid SSR component for the root HTML of an editor.
 *
 * @param props Props.
 * @param props.view The webview being created.
 * @param props.extensionUri `vscode.ExtensionContext.extensionUri`
 */
export default function WebviewHtml(props: WebviewHtmlProps) {
	const pathOf = (...parts: string[]) =>
		props.view.asWebviewUri(Uri.joinPath(props.extensionUri, ...parts)).toString();

	// Linter warns these won't be reactive... we're oneshotting this so I really don't care
	const script = pathOf('dist', 'editor.js');
	const codicons = pathOf('dist', 'codicon.css');
	const style = pathOf('media', 'vscode.css');
	const layout = pathOf('media', 'layout.css');

	const nonce = randomBytes(32).toString('base64');

	return (
		<html lang='en'>
			<head>
				<meta charset='utf-8' />

				<meta
					http-equiv='content-security-policy'
					content={csp(props.view.cspSource, nonce)}
				/>

				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>JSON Editor</title>

				<link rel='stylesheet' href={style} />
				<link rel='stylesheet' href={codicons} />
				<link rel='stylesheet' href={layout} />
				<script defer src={script} nonce={nonce} />
			</head>
			<body>
				<div id='jsonContainer' />
				<button type='button' id='rootPlus'>
					<i class='codicon codicon-plus' /> New Item
				</button>
				{/* TODO: restore this when you resume Solid work */}
				{/* <div class='split'>
					<div id='jsonContainerNew' />
					<div>
						<div id='jsonContainer' />
						<button type='button' id='rootPlus'>
							<i class='codicon codicon-plus' /> New Item
						</button>
					</div>
				</div> */}
			</body>
		</html>
	);
}

WebviewHtml.toString = (props: WebviewHtmlProps) =>
	renderToString(() => <WebviewHtml {...props} />);

/**
 * Allow only images from HTTPS or this extension, styles and fonts from this extension,
 * and scripts with a certain nonce.
 */
const csp = (source: string, nonce: string): string =>
	[
		"default-src 'none';",
		`img-src ${source} blob:;`,
		`style-src ${source};`,
		`font-src ${source};`,
		`script-src 'nonce-${nonce}';`,
	].join(' ');

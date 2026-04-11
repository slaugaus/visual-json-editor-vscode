import vscode from './vscodeWebview';

/**
 * Sends the extension an error message to display.
 *
 * @param message The error message.
 */
export default function errorMsg(message: string): void {
	vscode.postMessage({ type: 'errorMsg', message });
}

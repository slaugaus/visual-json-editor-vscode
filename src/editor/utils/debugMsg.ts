import vscode from './vscodeWebview';

/**
 * Sends the extension a message with debugging info (which it displays and prints).
 *
 * @param message The debug message.
 */
export default function debugMsg(message: string): void {
	vscode.postMessage({ type: 'debugMsg', message });
}

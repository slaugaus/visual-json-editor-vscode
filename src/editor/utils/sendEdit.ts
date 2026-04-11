import type { JsonEdit } from '@common/messaging/JsonEdit';

import { shouldIgnoreEdits } from './ignoreEdits';
import vscode from './vscodeWebview';

/**
 * Notifies the extension that an edit was made.
 *
 * @param path Path to the modified item (use getPathToItem).
 * @param edit The edit to send.
 */
export default function sendEdit(edit: JsonEdit): void {
	if (!shouldIgnoreEdits()) {
		vscode.postMessage({ type: 'Edit', edit });
	}
}

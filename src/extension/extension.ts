import type vscode from 'vscode';

import JsonEditorProvider from './JsonEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(JsonEditorProvider.register(context));
}

export function deactivate() {}

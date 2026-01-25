// VSCode API
import * as vscode from 'vscode';
import { JsonEditorProvider } from './JsonEditorProvider';

// The entrypoint for the extension. Called on activation.
export function activate(context: vscode.ExtensionContext) {

	// Register the main editor & whatever else is in there
	context.subscriptions.push(JsonEditorProvider.register(context));

	// console.log('Visual JSON Editor loaded!');
}

// This method is called when your extension is deactivated
export function deactivate() {}

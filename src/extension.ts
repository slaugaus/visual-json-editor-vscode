// VSCode API
import * as vscode from 'vscode';
import { JsonEditorProvider } from './JsonEditorProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('visual-json.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from visual-json!');
	});
	
	context.subscriptions.push(disposable);
	context.subscriptions.push(JsonEditorProvider.register(context));

	console.log('Visual JSON Editor loaded!');
}

// This method is called when your extension is deactivated
export function deactivate() {}

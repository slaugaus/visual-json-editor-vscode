import { randomUUID, type UUID } from 'node:crypto';

import vscode from 'vscode';

import { type EditorHtml } from '@common/messaging/EditorHtml';
import {
	type GetDataResponse,
	type EditorMessage,
} from '@common/messaging/EditorMessage';
import { type ExtensionMessage } from '@common/messaging/ExtensionMessage';

import buildViewHtml from './buildViewHtml';
import { disposeAll } from './disposal';
import JsonDocument from './JsonDocument';
import WebviewCollection from './WebviewCollection';

export default class JsonEditorProvider implements vscode.CustomEditorProvider {
	constructor(private readonly _context: vscode.ExtensionContext) {}

	/** Name/ID of the custom editor - reference this in commands that open it */
	private static readonly _viewType = 'visual-json.mainEditor';

	static register(context: vscode.ExtensionContext) {
		// Register any commands here

		return vscode.window.registerCustomEditorProvider(
			JsonEditorProvider._viewType,
			new JsonEditorProvider(context),
			{
				/**
				 * This option keeps editor webviews "alive" when they're not visible. It uses
				 * extra RAM, but is necessary to preserve the document (which is currently stored
				 * in/as the UI).
				 *
				 * @todo Look for a way to let this be false? (Something about state in view's
				 *   code)
				 */
				webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true },
				// TODO: (STRETCH/QOL) Look into syncing state between editors
				//  - Remove error check in getData()
				supportsMultipleEditorsPerDocument: false,
			},
		);
	}

	private readonly _openWebviews = new WebviewCollection();

	//#region CustomEditorProvider Implementation

	// Called the first time a file is opened in the editor.
	// (Opening more editors for the same file reuses the same JsonDocument)
	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken,
	): Promise<JsonDocument> {
		const document = await JsonDocument.create(uri, openContext.backupId, {
			// Implement retrieving data from the webview here, as JsonDocument
			// doesn't get to access it. Hooray for delegates!
			getData: async () => await this._getData(document),
		});

		const docListeners: vscode.Disposable[] = [];

		// Event telling VS Code that edits were made
		docListeners.push(
			document.onDidChange(event => {
				this._onDidChangeCustomDocument.fire({
					document,
					...event,
				});
			}),
		);

		// Event telling all the webviews that the document changed
		docListeners.push(
			document.onDidChangeContent(event => {
				for (const panel of this._openWebviews.get(document.uri)) {
					this._sendMessage(panel, { type: 'change', changes: [...event.edits] });
				}
			}),
		);

		// Dispose these while disposing the document
		document.onDidDispose(() => {
			disposeAll(docListeners);
		});

		return document;
	}

	// Called whenever a new custom editor is opened.
	async resolveCustomEditor(
		document: JsonDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		this._openWebviews.add(document.uri, webviewPanel);

		webviewPanel.webview.options = { enableScripts: true };

		webviewPanel.webview.html = buildViewHtml(
			webviewPanel.webview,
			this._context.extensionUri,
		);

		// Subscribe to messages from this webview
		webviewPanel.webview.onDidReceiveMessage(event => {
			this._onGetMessage(document, event);
		});

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(event => {
			if (event.type === 'ready') {
				if (document.uri.scheme === 'untitled') {
					// Handle any setup necessary for new documents (probably none?)
				} else {
					this._sendMessage(webviewPanel, { type: 'document', content: document.object });
				}
			}
		});
	}

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
		vscode.CustomDocumentEditEvent<JsonDocument>
	>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	public saveCustomDocument(
		document: JsonDocument,
		cancellation: vscode.CancellationToken,
	): Thenable<void> {
		const save = document.save(cancellation);
		this._sendMessageAll(document, { type: 'saved', content: document.object });
		return save;
	}

	public saveCustomDocumentAs(
		document: JsonDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Thenable<void> {
		const saveAs = document.saveAs(destination, cancellation);
		this._sendMessageAll(document, { type: 'saved', content: document.object });
		return saveAs;
	}

	public revertCustomDocument(
		document: JsonDocument,
		cancellation: vscode.CancellationToken,
	): Thenable<void> {
		return document.revert(cancellation);
	}

	public backupCustomDocument(
		document: JsonDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken,
	): Thenable<vscode.CustomDocumentBackup> {
		return document.backup(context.destination, cancellation);
	}

	//#endregion

	//#region Messaging

	/** Strongly typed! */
	private _sendMessage(panel: vscode.WebviewPanel, message: ExtensionMessage): void {
		panel.webview.postMessage(message);
	}

	/** Messages all webviews belonging to a JsonDocument. */
	private _sendMessageAll(document: JsonDocument, message: ExtensionMessage): void {
		for (const panel of this._openWebviews.get(document.uri)) {
			this._sendMessage(panel, message);
		}
	}

	private readonly _callbacks = new Map<UUID, (value: GetDataResponse) => void>();

	/** Requests the data from the given document, returning it as a promise. */
	private async _getData(document: JsonDocument): Promise<EditorHtml> {
		const webviewsForThisDoc = [...this._openWebviews.get(document.uri)];

		if (webviewsForThisDoc.length === 0) {
			throw new Error('Could not find a webview for this document');
		} else if (webviewsForThisDoc.length > 1) {
			throw new Error('Doc is somehow open in multiple tabs...');
		}

		const requestId = randomUUID();
		// oxlint-disable-next-line promise/avoid-new -- presumably an edge case
		const promise = new Promise<GetDataResponse>(resolve =>
			this._callbacks.set(requestId, resolve),
		);

		this._sendMessage(webviewsForThisDoc[0], { type: 'getData', requestId });

		return promise;
	}

	private _onGetMessage(document: JsonDocument, message: EditorMessage): void {
		switch (message.type) {
			case 'getData_response': {
				this._callbacks.get(message.requestId)?.(message);
			}

			case 'ready':
				return;

			case 'edit': {
				document.makeEdit(message.edit);
				return;
			}

			case 'debugMsg': {
				vscode.window.showInformationMessage(message.message);
				console.log(message.message);
				return;
			}

			case 'errorMsg': {
				vscode.window.showErrorMessage(message.message);
				console.error(message.message);
				return;
			}
		}
	}

	//#endregion
}

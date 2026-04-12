import { parse as parseJson, stringify } from 'lossless-json';
import * as vscode from 'vscode';

import type { EditorHtml } from '@common/messaging/EditorHtml';
import type { JsonEdit } from '@common/messaging/JsonEdit';

import { Disposable } from './utils/disposal';
import parseHtml from './utils/parseHtml';

type GetDataDelegate = {
	getData(): Promise<EditorHtml>;
};

/** Handles loading and saving the JSON file, including serialization. */
export default class JsonDocument extends Disposable implements vscode.CustomDocument {
	/**
	 * Creates a new instance from a URI.
	 *
	 * @param delegate Function getData (within object) that returns the HTML containing
	 *   this document's updated data. Implemented in JsonEditorProvider since it has access
	 *   to the webviews and I don't.
	 */
	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
		delegate: GetDataDelegate,
	): Promise<JsonDocument | PromiseLike<JsonDocument>> {
		// Read the backup if it exists, otherwise get the file at uri
		const actualUri = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;

		if (typeof backupId === 'string') {
			console.log(`Visual JSON Editor loaded a backup from ${backupId}`);
		}

		const fileObj = await JsonDocument._readFile(actualUri);
		return new JsonDocument(uri, fileObj, delegate);
	}

	public get uri() {
		return this._uri;
	}

	/** The JSON object, serialized, in the state it is on disk. */
	public get object() {
		return this._object;
	}

	private constructor(
		private readonly _uri: vscode.Uri,
		private _object: unknown,
		private readonly _delegate: GetDataDelegate,
	) {
		super();
	}

	private _freshEdits: JsonEdit[] = [];
	private _savedEdits: JsonEdit[] = [];

	//#region Editing

	private readonly _onDidChangeDocument = this._register(
		new vscode.EventEmitter<{
			readonly content?: unknown;
			readonly edits: readonly JsonEdit[];
		}>(),
	);

	/** Fired to notify webviews of a change to the document. */
	public readonly onDidChangeContent = this._onDidChangeDocument.event;

	private readonly _onDidChange = this._register(
		new vscode.EventEmitter<{ readonly label: string; undo(): void; redo(): void }>(),
	);

	/**
	 * Fired to tell VS Code that an edit happened, and how to un/redo it.
	 *
	 * This gives tabs the "dirty indicator" (dot).
	 */
	public readonly onDidChange = this._onDidChange.event;

	/**
	 * Call when an edit is made in the webview.
	 *
	 * @todo Doesn't do anything to the object. Does it need to?
	 */
	makeEdit(edit: JsonEdit) {
		this._freshEdits.push(edit);

		// Tell VS Code about the edit
		this._onDidChange.fire({
			label: edit.type,
			undo: async () => {
				// On undo, send open editors the list of edits minus the undone one
				this._freshEdits.pop();
				this._onDidChangeDocument.fire({ edits: this._freshEdits });
			},
			redo: async () => {
				// On redo, send open editors the new list of edits
				this._freshEdits.push(edit);
				this._onDidChangeDocument.fire({ edits: this._freshEdits });
			},
		});
	}

	//#endregion

	//#region File I/O

	/** Attempts to parse the file at (uri) as JSON. Returns the object if successful. */
	private static async _readFile(uri: vscode.Uri): Promise<unknown> {
		if (uri.scheme === 'untitled') {
			return {};
		}

		// Limit file size
		const maxFileSize =
			vscode.workspace.getConfiguration('visual-json').get<number>('maxFileSize') ?? 256;

		const fileStats = await vscode.workspace.fs.stat(uri);
		if (fileStats.size > maxFileSize * 1024) {
			await JsonDocument._errorWithFallback(
				`File is ${(fileStats.size / 1024).toFixed(2)} KB. Max allowed size is ${maxFileSize} KB. (This can be changed in settings)`,
				uri,
			);
			return {};
		}

		const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
		const text: string = doc.getText();

		// Don't throw parsing errors if file is nothing or whitespace
		if (/^\s*$/.test(text)) {
			return {};
		}

		try {
			return parseJson(text);
		} catch (error) {
			if (error instanceof SyntaxError) {
				await JsonDocument._errorWithFallback(
					`File is not valid JSON. ${error.message}`,
					uri,
				);
			} else if (error instanceof Error) {
				await JsonDocument._errorWithFallback(
					`Unknown error parsing file. ${error.name}: ${error.message}`,
					uri,
				);
			}
			return undefined;
		}
	}

	/**
	 * File problems? Shows a modal with a custom message and an option to open with the
	 * plaintext editor.
	 */
	private static async _errorWithFallback(message: string, uri: vscode.Uri) {
		const selectedOption = await vscode.window.showErrorMessage(
			`Visual JSON Editor Error:\n${message}`,
			{ modal: true },
			'Open with Text Editor',
			// Cancel button added automatically
		);

		// Close whether canceled or reopened
		vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		if (selectedOption === 'Open with Text Editor') {
			vscode.commands.executeCommand('vscode.openWith', uri, 'default');
		}
	}

	async save(cancellation: vscode.CancellationToken) {
		await this.saveAs(this._uri, cancellation);
		this._savedEdits = [...this._freshEdits];
	}

	async saveAs(uri: vscode.Uri, cancellation: vscode.CancellationToken) {
		const editorData = await this._delegate.getData();

		const { type, data } = parseHtml(editorData);

		// Avoid data loss - catch readHtml returning empty
		if (editorData.html.length > 0) {
			if (
				(type === 'array' && data.length === 0) ||
				(type === 'object' && Object.keys(data).length === 0)
			) {
				vscode.window.showErrorMessage(
					`Save failed! Got an empty ${type} even though there should be content.`,
				);
				cancellation.isCancellationRequested = true;
				return;
			}
		}

		// Read from settings (defaults to 2 as defined in package.json)
		const prettiness = vscode.workspace
			.getConfiguration('visual-json')
			.get<number>('outputPrettiness');

		const stringified = stringify(data, null, prettiness);

		// fs.writeFile requires a Uint8Array
		const encoded: Uint8Array = new TextEncoder().encode(stringified);

		if (cancellation.isCancellationRequested) {
			return;
		}

		this._object = data; // Update backing object to match what's on disk
		vscode.workspace.fs.writeFile(uri, encoded);
	}

	/** Reverts to the state of the file at its last save. */
	async revert(cancellation: vscode.CancellationToken): Promise<void> {
		const fileOnDisk = JsonDocument._readFile(this.uri);
		if (cancellation.isCancellationRequested) {
			return;
		}
		this._object = fileOnDisk;
		this._freshEdits = this._savedEdits;
		this._onDidChangeDocument.fire({
			content: await fileOnDisk,
			edits: this._freshEdits,
		});
	}

	/** Called by VS Code if it needs to save a backup. */
	async backup(
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);
		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// ignore errors; we don't care whether the delete worked
				}
			},
		};
	}

	//#endregion

	//#region Disposal

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDidDispose = this._onDidDispose.event;

	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}

	//#endregion
}

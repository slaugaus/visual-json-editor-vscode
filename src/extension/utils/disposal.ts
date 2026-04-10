import type vscode from 'vscode';

export function disposeAll(disposables: vscode.Disposable[]): void {
	while (disposables.length > 0) {
		const item = disposables.pop();
		if (item) {
			item.dispose();
		}
	}
}

/** A class that has multiple children you'd want to dispose of. */
export abstract class Disposable {
	private _isDisposed = false;
	protected get isDisposed(): boolean {
		return this._isDisposed;
	}

	protected _disposables: vscode.Disposable[] = [];

	/** Disposes everything I own. BURN IT ALL!! */
	public dispose(): void {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		disposeAll(this._disposables);
	}

	/**
	 * Takes responsibility for disposing a Disposable.
	 *
	 * @param value What to register.
	 * @returns The value that was registered.
	 */
	protected _register<T extends vscode.Disposable>(value: T): T {
		if (this._isDisposed) {
			value.dispose();
		} else {
			this._disposables.push(value);
		}
		return value;
	}
}

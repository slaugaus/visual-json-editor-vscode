/**
 * Slightly modified from the DefinitelyTyped declaration.
 * (https://www.npmjs.com/package/@types/vscode-webview)
 * MIT License
 */

import type { Message } from '../common';

/**
 * API that VS Code exposes to webviews.
 *
 * @template TState Type of the persisted state stored for the webview.
 */
export interface WebviewApi<TState> {
	/**
	 * Post a message to the owner of the webview.
	 *
	 * @param message Data to post. Must be JSON serializable.
	 * @template T Type of the message's body. Not in the JS, obviously
	 */
	postMessage<T = unknown>(message: Message<T>): void;

	/**
	 * Get the persistent state stored for this webview.
	 *
	 * @return The current state or `undefined` if no state has been set.
	 */
	getState(): TState | undefined;

	/**
	 * Set the persistent state stored for this webview.
	 *
	 * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
	 * using {@link getState}.
	 *
	 * @return The new state.
	 */
	setState<T extends TState | undefined>(newState: T): T;
}

declare function acquireVsCodeApi<StateType = unknown>(): WebviewApi<StateType>;
export const vscode = acquireVsCodeApi<unknown>();

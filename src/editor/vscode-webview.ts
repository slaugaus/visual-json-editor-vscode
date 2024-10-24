/**
 * Slightly modified from the DefinitelyTyped declaration.
 * (https://www.npmjs.com/package/@types/vscode-webview)
 * MIT License
 */

import { Message } from "../common";

/**
 * API that VS Code exposes to webviews.
 *
 * @template StateType Type of the persisted state stored for the webview.
 */
interface WebviewApi<StateType> {
    /**
     * Post a message to the owner of the webview.
     *
     * @param message Data to post. Must be JSON serializable.
     * @template TBody Type of the message's body. Not in the JS, obviously
     */
    postMessage<TBody = any>(message: Message<TBody>): void;

    /**
     * Get the persistent state stored for this webview.
     *
     * @return The current state or `undefined` if no state has been set.
     */
    getState(): StateType | undefined;

    /**
     * Set the persistent state stored for this webview.
     *
     * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
     * using {@link getState}.
     *
     * @return The new state.
     */
    setState<T extends StateType | undefined>(newState: T): T;
}

declare function acquireVsCodeApi<StateType = unknown>(): WebviewApi<StateType>;
export const vscode = acquireVsCodeApi<unknown>();
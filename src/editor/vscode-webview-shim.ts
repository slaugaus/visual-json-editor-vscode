/**
 * Shim for the VS Code webview API that forwards messages to Tauri and "persists"
 * the state stuff.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Message } from '../common';
import type { WebviewApi } from './vscode-webview';

let persistedState: unknown;

class vscode<StateType> implements WebviewApi<StateType> {
	postMessage<TBody = unknown>(message: Message<TBody>): void {
		console.log('[vscode-webview-shim] postMessage:', message);
		invoke('receive_message', message);
	}

	getState(): StateType | undefined {
		return persistedState as StateType | undefined;
	}

	setState<T extends StateType | undefined>(newState: T): T {
		persistedState = newState;
		return newState;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: No way around this, I believe
(globalThis as any).acquireVsCodeApi = <TState>() => new vscode<TState>();

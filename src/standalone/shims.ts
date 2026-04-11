// oxlint-disable typescript/no-unsafe-type-assertion -- DOM abuse galore
import { invoke } from '@tauri-apps/api/core';
import type { InvokeArgs } from '@tauri-apps/api/core';

import type { EditorMessage } from '@common/messaging/EditorMessage';
import type { WebviewApi } from '@common/WebviewApi';

let persistedState: unknown = undefined;

/**
 * Shim for the VS Code webview API that forwards messages to Tauri and "persists" the
 * state stuff.
 */
class vscode<StateType> implements WebviewApi<StateType> {
	postMessage(message: EditorMessage): void {
		void invoke('receive_message', { message });
	}

	getState(): StateType | undefined {
		return persistedState as StateType | undefined;
	}

	setState<T extends StateType | undefined>(newState: T): T {
		persistedState = newState;
		return newState;
	}
}

(globalThis as any).acquireVsCodeApi = <TState>() => new vscode<TState>();

// Allow browser access for debugging
if (!(globalThis as any).__TAURI_INTERNALS__) {
	(globalThis as any).__TAURI_INTERNALS__ = {
		invoke: (cmd: string, args: InvokeArgs) => {
			console.log('[not-tauri]', cmd, JSON.stringify(args, null, 2));
		},
	};
}

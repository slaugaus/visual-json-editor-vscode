import type { WebviewApi } from '@common/WebviewApi';

declare function acquireVsCodeApi<StateType = unknown>(): WebviewApi<StateType>;

const vscode = acquireVsCodeApi();

export default vscode;

import type { ExtensionMessage } from '@common/messaging/ExtensionMessage';

import EditorItem from './components/EditorItem';
import cleanChanged from './utils/cleanChanged';
import debugMsg from './utils/debugMsg';
import jsonContainer from './utils/jsonContainer';
import parseObject from './utils/parseObject';
import playbackEdits from './utils/playbackEdits';
import sendEdit from './utils/sendEdit';
import vscode from './utils/vscodeWebview';

/** The object I was initialized with */
let startingObject: unknown = {};

const safeClassName = () => {
	if (jsonContainer.className === 'object' || jsonContainer.className === 'array') {
		return jsonContainer.className;
	}
	throw new Error('#jsonContainer is missing its type!');
};

// Message Handler
window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
	const message = event.data;
	switch (message.type) {
		// Entrypoint for object parser (extension has a JsonDocument ready)
		case 'document':
			jsonContainer.textContent = null;
			startingObject = message.content;
			parseObject(message.content, jsonContainer);
			// vscode.setState(something);
			return;

		// Extension requested a save
		case 'getData':
			vscode.postMessage({
				type: 'GetDataResponse',
				requestId: message.requestId,
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				rootType: safeClassName(),
				html: jsonContainer.innerHTML,
			});
			return;

		// Extension finished saving, clear dirty states and update the base object
		case 'saved':
			cleanChanged();
			startingObject = message.content;
			return;

		// Extension requested change to the document (Undo, redo, or revert)
		case 'change':
			jsonContainer.textContent = null;
			parseObject(startingObject, jsonContainer);
			playbackEdits(message.changes);
			return;

		default:
			debugMsg(`Editor received an unknown message: ${JSON.stringify(message)}`);
			return;
	}
});

// TODO: Try out state recovery
// (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate)
// const lastState = vscode.getState();
// if (lastState) {}

document.getElementById('rootPlus')!.addEventListener('click', _ => {
	const numRootItems = jsonContainer.childElementCount;
	const newThing = EditorItem.create(
		'null',
		`New Thing ${numRootItems}`,
		null,
		jsonContainer,
		safeClassName(),
	);

	sendEdit({
		type: 'Add',
		path: newThing.path,
		itemType: 'null',
		value: null,
		parentType: safeClassName(),
	});

	newThing.makeDirty();
	newThing.highlightAndScroll();
});

vscode.postMessage({ type: 'Ready' });

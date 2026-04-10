import { LosslessNumber } from 'lossless-json';
import { HTMLElement, parse as parseHtmlReal } from 'node-html-parser';
import vscode from 'vscode';

import { type EditorHtml } from '@common/messaging/EditorHtml';
import { type JsonUnknown } from '@common/messaging/JsonUnknown';
import { EditorType, EditorSubTypeTable } from '@common/schema/EditorType';

/**
 * Entrypoint for parsing HTML from the editor.
 *
 * @param data Contents of #jsonContainer
 * @returns A JSON-serializable object
 */
export default function parseHtml({
	rootType,
	html,
}: EditorHtml): { type: 'array'; data: unknown[] } | { type: 'object'; data: object } {
	const container = parseHtmlReal(html);

	switch (rootType) {
		case 'array':
			return readArray(container);
		case 'object':
			return readObject(container);
		default:
			return rootType satisfies never;
	}
}

// These are only separated for ultra type safety :(
const readArray = (container: HTMLElement) => {
	const data: unknown[] = [];

	for (const child of container.childNodes) {
		// TODO: these may not work
		if (child instanceof HTMLElement) {
			addFromNode(child, data);
		}
	}

	return {
		type: 'array' as const,
		data,
	};
};

const readObject = (container: HTMLElement) => {
	const data = {};

	for (const child of container.childNodes) {
		if (child instanceof HTMLElement) {
			addFromNode(child, data);
		}
	}

	return {
		type: 'object' as const,
		data,
	};
};

/**
 * Given child (the value as a <details> key/value pair), extract the key+value and add
 * them to parent (possibly recurring to do it fully).
 */
const addFromNode = (child: HTMLElement, parent: unknown) => {
	const keyElement = child.querySelector('.key');
	const valElement = child.querySelector('.value');
	const childKey = keyElement?.querySelector('.name')?.textContent;

	if (!keyElement || !valElement || !childKey) {
		throw new Error('Node is missing classes .key, .value, and/or .name');
	}

	// TODO: Detect and ignore (or fill in?) incomplete elements

	let type = getTypeOfElement(child);
	type = EditorSubTypeTable[type] ?? type; // Get base type

	const childValue = getChildValue(type, valElement);

	// Fun fact: Arrays can be indexed by strings of ints!
	// (It doesn't matter that parent: Array is having its "0" set)
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	(parent as Record<string, JsonUnknown>)[childKey] = childValue;
};

const getChildValue = (type: string, element: HTMLElement): JsonUnknown => {
	switch (type) {
		case 'string':
			return element.textContent;
		case 'number':
			return new LosslessNumber(element.textContent || '0');
		case 'boolean':
			return element.textContent === 'true';
		case 'null':
			return null;
		case 'object': {
			const value = {};
			for (const grandchild of element.childNodes) {
				if (grandchild instanceof HTMLElement) {
					addFromNode(grandchild, value);
				}
			}
			return value;
		}
		case 'array': {
			const value: unknown[] = [];
			for (const grandchild of element.childNodes) {
				if (grandchild instanceof HTMLElement) {
					addFromNode(grandchild, value);
				}
			}
			return value;
		}
		default:
			throw new TypeError(`Tried to save unknown type: ${type}`);
	}
};

/**
 * Read ele.classList and return the type it contains.
 *
 * Theoretically the type will always be class #2, but don't make that assumption.
 */
const getTypeOfElement = (ele: HTMLElement): string => {
	const result = ele.classList.value.filter(val => EditorType.safeParse(val).success);

	if (result.length > 1) {
		vscode.window.showErrorMessage(
			`Element ${ele.outerHTML} has multiple types (${result.join(', ')})! Returning the first one.`,
		);
	}
	return result[0];
};

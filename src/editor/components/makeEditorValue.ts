import type { LosslessNumber } from 'lossless-json';

import type { EditorValue } from '../types/EditorValue';
import type { PartialEditDelegate } from '../types/PartialEditDelegate';
import EditorBool from './editorValues/EditorBool';
import EditorCollection from './editorValues/EditorCollection';
import EditorColor from './editorValues/EditorColor';
import EditorDateTime from './editorValues/EditorDateTime';
import EditorNumber from './editorValues/EditorNumber';
import EditorString from './editorValues/EditorString';

type MakeEditorValueCommand = {
	target: HTMLDivElement;
	delegate: PartialEditDelegate;
} & (
	| {
			type: 'string' | 'color';
			value: string;
	  }
	| {
			type: 'number';
			value: number | LosslessNumber;
	  }
	| {
			type: 'boolean';
			value: boolean;
	  }
	| {
			type: 'object' | 'array';
			value: object | unknown[];
	  }
	| {
			type: 'datetime';
			value: string | number;
	  }
	| {
			type: 'null';
			value: null | undefined;
	  }
);

/**
 * EditorValue factory.
 *
 * @param params Command parameters.
 * @param params.type Type of the value.
 * @param params.value The value.
 * @param params.target Where it's going.
 * @param params.delegate A partial edit delegate.
 */
export default function makeEditorValue({
	type,
	value,
	target,
	delegate,
}: MakeEditorValueCommand): EditorValue | undefined {
	switch (type) {
		case 'string':
			return new EditorString(value, target, delegate);
		case 'number':
			return new EditorNumber(value, target, delegate);
		case 'boolean':
			return new EditorBool(value, target, delegate);
		case 'object':
		case 'array':
			return new EditorCollection(type, value, target);
		case 'color':
			return new EditorColor(value, target, delegate);
		case 'datetime':
			return new EditorDateTime(value, target, delegate);
		case 'null':
			return undefined;
		default:
			return type satisfies never;
	}
}

/**
 * GUIDE TO TYPE ADDITION (outdated)
 *
 * - Common.ts: Add to editorSubTypes
 * - {@link Helpers}:
 *
 *   - Put a Codicon in {@link codiconMap}
 *   - Add to {@link validConversions}
 *   - Detect your type in {@link detectType} or {@link detectSpecialString}
 * - Implement a new type class here; {@link EditorBool} is a good reference
 * - Add your type class to {@link EditorValue.create}
 * - If you get yelled at on save, fix JsonDocument._addFromNode
 * - Add to {@link setValueOfItem}
 */

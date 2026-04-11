import type { EditorType } from '../schema/EditorType';
import type { JsonUnknown } from './JsonUnknown';

/** Edits made to a JsonDocument. */
export type JsonEdit = {
	path: string[];
} & (
	| {
			type: 'contents';
			newValue: JsonUnknown;
	  }
	| {
			type: 'add';
			itemType: EditorType;
			value: JsonUnknown;
			parentType: 'object' | 'array';
	  }
	| {
			type: 'delete';
	  }
	| {
			type: 'rename';
			newName: string;
	  }
	| {
			type: 'move';
			direction: 'up' | 'down';
	  }
	| {
			type: 'type';
			newType: EditorType;
	  }
);

export type JsonEditType = 'contents' | 'add' | 'delete' | 'rename' | 'move' | 'type';

import type { EditorType } from '../schema/EditorType';
import type { JsonUnknown } from './JsonUnknown';

/** Edits made to a JsonDocument. */
export type JsonEdit = {
	path: string[];
} & (
	| {
			type: 'Contents';
			newValue: JsonUnknown;
	  }
	| {
			type: 'Add';
			itemType: EditorType;
			value: JsonUnknown;
			parentType: 'object' | 'array';
	  }
	| {
			type: 'Delete';
	  }
	| {
			type: 'Rename';
			newName: string;
	  }
	| {
			type: 'Move';
			direction: 'up' | 'down';
	  }
	| {
			type: 'Type';
			newType: EditorType;
	  }
);

export type JsonEditType = 'Contents' | 'Add' | 'Delete' | 'Rename' | 'Move' | 'Type';

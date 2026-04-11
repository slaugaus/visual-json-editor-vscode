import { EditorType } from '@common/schema/EditorType';

/** What types (self included) can a given type safely convert to? */
const validConversions: ReadonlyMap<string, string[]> = new Map(
	Object.entries({
		string: ['string'],
		number: ['number', 'string'],
		boolean: ['boolean', 'string'],
		array: ['array'], // TODO: array to object is safe but needs special handling
		object: ['object'],
		color: ['color', 'string'],
		datetime: ['datetime', 'string'],
		null: EditorType.options, // any
	}),
);

export default validConversions;

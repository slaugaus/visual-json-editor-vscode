import { z } from 'zod/mini';

/** The types that one editor component can be. */
export const EditorType = z.enum([
	'string',
	'number',
	'boolean',
	'object',
	'array',
	'color',
	'datetime',
]);

export type EditorType = z.infer<typeof EditorType>;

/** Map of "special" types to their underlying type. */
export const EditorSubTypeTable: Readonly<Record<string, EditorType>> = Object.freeze({
	color: 'string',
	datetime: 'string',
});

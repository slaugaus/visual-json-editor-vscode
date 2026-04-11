import type { z } from 'zod';
import { enum as znum } from 'zod/mini';

/** The types that one editor component can be. */
export const EditorType = znum([
	'string',
	'number',
	'boolean',
	'object',
	'array',
	'null',
	'color',
	'datetime',
]);

// TODO: use zod for more than runtime enums lol

export type EditorType = z.infer<typeof EditorType>;

/** Map of "special" types to their underlying type. */
export const EditorSubTypeTable: Readonly<Record<string, EditorType>> = Object.freeze({
	color: 'string',
	datetime: 'string',
});

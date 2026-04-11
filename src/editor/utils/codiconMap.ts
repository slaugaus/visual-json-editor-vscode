/** Lookup table for Codicons. */
const codiconMap: ReadonlyMap<string, string> = new Map(
	Object.entries({
		// JSON Types
		string: 'codicon codicon-quote',
		number: 'codicon codicon-symbol-number',
		boolean: 'codicon codicon-circle-large-outline',
		null: 'codicon codicon-question',
		array: 'codicon codicon-array',
		object: 'codicon codicon-symbol-object',
		// Other Useful
		true: 'codicon codicon-pass-filled',
		false: 'codicon codicon-circle-large-outline',
		dirty: 'codicon codicon-close-dirty',
		// Extra Types
		color: 'codicon codicon-paintcan',
		datetime: 'codicon codicon-calendar',
	}),
);

export default codiconMap;

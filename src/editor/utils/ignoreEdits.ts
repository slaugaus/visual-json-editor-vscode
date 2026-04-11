let ignoreEdits = false;

/** Determines whether edits should be ignored. */
export function shouldIgnoreEdits(): boolean {
	return ignoreEdits;
}

/**
 * Sets the global "ignore edits" flag that {@link shouldIgnoreEdits} reads.
 *
 * @param value What to set it to.
 */
export function setIgnoreEdits(value: boolean): void {
	ignoreEdits = value;
}

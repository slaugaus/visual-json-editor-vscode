import getItemName from './getItemName';

/**
 * Determines an EditorItem's lineage up to (not including) jsonContainer.
 *
 * @param item A `details.item`.
 * @param path Used in recursion.
 * @returns The path to the item.
 */
export default function getPathToItem(item: Element, path: string[] = []): string[] {
	const name = getItemName(item);
	if (name) {
		path.unshift(name);
	}

	const parent =
		item.parentElement!.id !== 'jsonContainer' &&
		item.parentElement instanceof HTMLDivElement
			? item.parentElement.parentElement
			: item.parentElement;

	if (item.parentElement!.id === 'jsonContainer') {
		return path;
	} else if (parent) {
		getPathToItem(parent, path);
	}

	return path;
}

/**
 * Extracts the name from an EditorItem.
 *
 * @param item A DOM reference to an EditorItem.
 */
export default function getItemName(item: Element) {
	return item.querySelector(':scope>.key>.name')?.textContent;
}

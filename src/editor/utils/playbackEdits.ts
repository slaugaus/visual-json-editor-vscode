// oxlint-disable typescript/no-unsafe-type-assertion
import type { JsonEdit } from '@common/messaging/JsonEdit';
import type { JsonUnknown } from '@common/messaging/JsonUnknown';

import EditorItem from '../components/EditorItem';
import getItemName from './getItemName';
import { setIgnoreEdits } from './ignoreEdits';
import jsonContainer from './jsonContainer';

/**
 * Makes all the changes described in an array of edits.
 *
 * Thanks to ignoreEdits, some edit types can be applied just by triggering the same
 * events a user would!
 *
 * @param edits The edits to make.
 */
// oxlint-disable-next-line max-statements
export default function playbackEdits(edits: JsonEdit[]) {
	setIgnoreEdits(true);

	try {
		for (const edit of edits) {
			const target = getItemFromPath(edit.path);
			switch (edit.type) {
				case 'contents': {
					setValueOfItem(target, edit.newValue);
					break;
				}

				case 'add': {
					const name = edit.path.pop()!;
					const parent =
						edit.path.length === 0 ? jsonContainer : target.querySelector('.value');

					if (parent instanceof HTMLElement) {
						const newThing = EditorItem.create(
							edit.itemType,
							name,
							edit.value,
							parent,
							edit.parentType,
						);
						newThing.makeDirty();
					}
					break;
				}

				case 'delete': {
					target.querySelector('.delete-btn')?.dispatchEvent(new Event('click'));
					break;
				}

				case 'rename': {
					target.querySelector(':scope>.key>.name')!.textContent = edit.newName;
					(target.querySelector(':scope>.value') as HTMLElement)?.style.setProperty(
						'--array-parent-name',
						`'${edit.newName}['`,
					);
					break;
				}

				case 'move': {
					target
						.querySelector(`.${edit.direction}-btn`)
						?.dispatchEvent(new Event('click'));
					break;
				}

				case 'type': {
					if (edit.newType === 'null') {
						target.querySelector('.clear-btn')?.dispatchEvent(new Event('click'));
					} else {
						const dropdown = target.querySelector('select') as HTMLSelectElement;
						dropdown.value = edit.newType;
						dropdown.dispatchEvent(new Event('change'));
					}
					break;
				}
			}
		}
	} finally {
		setIgnoreEdits(false);
	}
}

const setValueOfItem = (item: Element, value: JsonUnknown) => {
	const type = (item.querySelector(':scope>.key>.type') as HTMLSelectElement).value;

	switch (type) {
		case 'string':
		case 'number':
			item.querySelector(':scope>.value')!.textContent = value as string;
			break;
		case 'boolean':
		case 'color':
		case 'datetime': {
			const input = item.querySelector(
				':scope>.value-container>label>input',
			) as HTMLInputElement;
			if (type === 'boolean') {
				input.checked = value === 'true';
			} else if (type === 'datetime') {
				input.value = (value as string).replace('Z', '');
			} else {
				input.value = value as string;
			}
			input.dispatchEvent(new Event('change'));
			break;
		}
		default:
			console.error(`    !TYPE UNIMPLEMENTED!`);
			break;
	}
};

const getItemFromPath = (path: string[]): Element => {
	let target: Element = document.querySelector('#jsonContainer')!;
	for (const itemName of path) {
		const searchTarget = target.querySelector(':scope>.value') ?? target;

		for (const item of searchTarget.children) {
			if (itemName === getItemName(item)) {
				target = item;
				break;
			}
		}
	}

	return target;
};

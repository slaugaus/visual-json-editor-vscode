// oxlint-disable typescript/no-unsafe-type-assertion
// oxlint-disable max-params

import type { JsonEdit } from '@common/messaging/JsonEdit';
import type { JsonUnknown } from '@common/messaging/JsonUnknown';
import type { EditorType } from '@common/schema/EditorType';

import type { EditorValue } from '../types/EditorValue';
import codicon from '../utils/codicon';
import codiconMap from '../utils/codiconMap';
import errorMsg from '../utils/errorMsg';
import getItemName from '../utils/getItemName';
import getPathToItem from '../utils/getPathToItem';
import { shouldIgnoreEdits } from '../utils/ignoreEdits';
import sendEdit from '../utils/sendEdit';
import validConversions from '../utils/validConversions';
import makeEditorValue from './makeEditorValue';

/** One <details> representing an item in a JSON object. */
export default class EditorItem {
	static create(
		type: EditorType,
		name: string,
		value: JsonUnknown,
		parent: HTMLElement,
		/** Needed for renaming. */
		parentType: 'object' | 'array',
	): EditorItem {
		return new EditorItem(type, name, value, parent, parentType);
	}

	private readonly _initialType: EditorType = 'null';

	private constructor(
		initialType: EditorType,
		initialName: string,
		initialValue: JsonUnknown,
		private readonly _parent: HTMLElement,
		private readonly _parentType: 'object' | 'array',
	) {
		this._initialType = initialType;

		this._setupHtml(initialType, initialName);

		this._setupEvents();

		this._setupValue(initialType, initialValue);

		this._parent.append(this.rootElement);

		// Edge case - Autogen name from add buttons could rarely cause a collision
		if (!this._nameIsUnique(initialName)) {
			// Not really a proper fix, only makes it rarer
			this._hName.textContent += ' (1)';
		}
	}

	//#region Public Methods/Properties
	get name() {
		return this._hName.textContent ?? 'unknown';
	}

	get type(): EditorType {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return (this._hType.value as EditorType) ?? 'unknown';
	}

	get value() {
		const maybeValue: string | undefined =
			this._value?.realValue?.innerHTML ?? this._value?.rootElement.innerHTML;
		return maybeValue ?? '';
	}

	// I wanted to cache this after the final append of setupHtml,
	// but that doesn't work for no clear reason
	get path() {
		return getPathToItem(this.rootElement);
	}

	readonly rootElement: HTMLDetailsElement = document.createElement('details');

	/**
	 * Turn on this item's "Dirty" (was changed) indicator(s). (Turning them off is done
	 * with querySelectorAll()s in global cleanChanged()).
	 */
	makeDirty() {
		this.rootElement.classList.add('changed');
	}

	/** Scroll to me (rootDiv) smoothly, with a highlight animation (CSS-dependent) */
	highlightAndScroll() {
		if (shouldIgnoreEdits()) {
			return;
		}

		this.rootElement.classList.add('highlighted');

		// Detect whether I'm visible
		new IntersectionObserver(
			(entries, observer) => {
				entries.forEach(entry => {
					// Item is in view
					if (entry.isIntersecting) {
						// Switch from static highlight to fade-out animation
						this.rootElement.classList.remove('highlighted');
						this.rootElement.classList.add('flash');

						// Remove the flash class after the animation is over (1s)
						setTimeout(() => {
							this.rootElement.classList.remove('flash');
						}, 1000);

						// Stop observing
						observer.disconnect();
					}

					// Otherwise, scroll to it
					else {
						this.rootElement.scrollIntoView({ behavior: 'smooth' });
					}
				});
				// Trigger when 100% visible
			},
			{ threshold: 1 },
		).observe(this.rootElement);
	}

	//#endregion

	//#region Private Stuff

	private _value?: EditorValue;

	// The HTML comprising this item:
	private readonly _hLabel = document.createElement('summary');
	private readonly _hIcon: HTMLElement = codicon(this._initialType);
	private readonly _hName = document.createElement('span');
	private readonly _hType = document.createElement('select');

	private readonly _hButtons = document.createElement('ul');
	private readonly _hValue = document.createElement('div');

	private readonly _btnDelete = document.createElement('li');
	private readonly _btnClear = document.createElement('li');
	private readonly _btnMoveDown = document.createElement('li');
	private readonly _btnMoveUp = document.createElement('li');

	// Type-specific button(s)
	private _btnAddItem: HTMLLIElement | undefined;

	//#region Initializers

	// oxlint-disable-next-line max-statements
	private _setupHtml(type: string, name: string) {
		// <details> (main container)
		this.rootElement.className = `item ${type}`;
		this.rootElement.open = true;

		// <summary> (key and type)
		this._hLabel.className = 'key';
		this.rootElement.append(this._hLabel);

		// <i> (Codicon inside label)
		this._hIcon.className = codiconMap.get(type)!;
		this._hLabel.append(this._hIcon);

		// name/key of item (inside label)
		this._hName.className = 'name clickable';
		this._hName.textContent = name;
		if (this._parentType !== 'array') {
			this._hName.classList.add('editable-text');
		}
		this._hLabel.append(this._hName);

		// type of item (inside label)
		this._hType.className = 'type clickable';
		this._hType.innerHTML = '';
		for (const conversionType of validConversions.get(type)!) {
			const option = document.createElement('option');
			option.value = conversionType;
			option.textContent = conversionType;
			this._hType.append(option);
		}
		if (this._hType.childElementCount <= 1) {
			this._hType.disabled = true;
		}
		this._hLabel.append(this._hType);

		this._hButtons.className = 'item-btns';
		for (const btn of this._hButtons.children) {
			if (btn.childElementCount > 0) {
				btn.innerHTML = '';
			}
		}
		this.rootElement.append(this._hButtons);

		this._btnDelete.title = 'Delete this item'; // Tooltip
		this._btnDelete.append(codicon('trash', 'a'));
		this._btnDelete.className = 'item-btn delete-btn';
		this._hButtons.append(this._btnDelete);

		this._btnClear.title =
			'Delete *the contents of* this item so you can change its type';
		this._btnClear.append(codicon('clear-all', 'a'));
		this._btnClear.className = 'item-btn clear-btn';
		this._hButtons.append(this._btnClear);

		this._btnMoveDown.title = 'Switch places with the item below me';
		this._btnMoveDown.append(codicon('arrow-down', 'a'));
		this._btnMoveDown.className = 'item-btn down-btn';
		this._hButtons.append(this._btnMoveDown);

		this._btnMoveUp.title = 'Switch places with the item above me';
		this._btnMoveUp.append(codicon('arrow-up', 'a'));
		this._btnMoveUp.className = 'item-btn up-btn';
		this._hButtons.append(this._btnMoveUp);

		// Type-specific button(s)
		if (this._btnAddItem) {
			this._btnAddItem.remove();
		}

		if (type === 'object' || type === 'array') {
			this._btnAddItem = document.createElement('li');
			this._btnAddItem.title = `Add an item to the ${type}`;
			this._btnAddItem.append(codicon('plus', 'a'));
			this._btnAddItem.className = 'item-btn add-btn';
			this._hButtons.append(this._btnAddItem);
		}
	}

	/** Define all of my interactivity. Reusable for type changer. */
	private _setupEvents() {
		// Allow other instances to call my makeDirty()
		this.rootElement.addEventListener('make-dirty', _ => this.makeDirty());
		this._hValue.addEventListener('make-dirty', _ => this.makeDirty());

		// Dispatch this after repositioning in an array to fix my index (name field).
		this.rootElement.addEventListener('renumber', _ => {
			const idx = [...this._parent.children].indexOf(this.rootElement);
			this._hName.textContent = idx.toString();
		});

		// Name editability (except for array members)
		this._hName.addEventListener('click', event => {
			if (this._parentType === 'object') {
				event.stopPropagation();
				event.preventDefault();
				this._makeNameEditable();
			}
		});

		// Type change logic
		this._hType.addEventListener('change', _ => {
			// If converting to obj or array, parse an empty object instead of an empty string
			// so the "length" property doesn't appear
			let realValue: unknown = this.value;
			if (
				(realValue === '' || realValue === undefined) &&
				(this._hType.value === 'object' || this._hType.value === 'array')
			) {
				realValue = {};
			}

			this._setupHtml(this.type, this.name);
			this._setupEvents();
			this._setupValue(this.type, realValue as JsonUnknown);
			this.makeDirty();

			sendEdit({ path: this.path, type: 'Type', newType: this.type });
		});

		this._btnDelete.addEventListener('click', _ => {
			sendEdit({ path: this.path, type: 'Delete' });
			this._parent.dispatchEvent(new Event('make-dirty'));
			this.rootElement.remove();
			if (this._parentType === 'array') {
				for (const child of this._parent.children) {
					child.dispatchEvent(new Event('renumber'));
				}
			}
		});

		this._btnClear.addEventListener('click', _ => {
			if (this.type !== 'null') {
				// Reset to a null object (so type can be freely changed)
				this._hType.disabled = false;
				this._hValue.innerHTML = '';
				this._setupHtml('null', this.name);
				this._setupEvents();
				this._setupValue('null', null);
				this.makeDirty();
				sendEdit({ path: this.path, type: 'Type', newType: 'null' });
			}
		});

		this._btnMoveDown.addEventListener('click', _ => {
			const next = this.rootElement.nextElementSibling;
			if (this._moveNextTo(next, next?.after.bind(next))) {
				sendEdit({ path: this.path, type: 'Move', direction: 'down' });
			}
		});

		this._btnMoveUp.addEventListener('click', _ => {
			const prev = this.rootElement.previousElementSibling;
			if (this._moveNextTo(prev, prev?.before.bind(prev))) {
				sendEdit({ path: this.path, type: 'Move', direction: 'up' });
			}
		});

		// For bools, let the icon act as a checkbox
		if (this.type === 'boolean') {
			// Icon also toggles value
			this._hIcon.addEventListener('click', event => {
				event.stopPropagation();
				event.preventDefault();
				this._hValue.dispatchEvent(new Event('external-toggle'));
			});

			// Icon matches checkbox state
			this._hValue.addEventListener('change-icon', event => {
				const { detail } = event as CustomEvent<string>;
				this._hIcon.className = codiconMap.get(detail) ?? '';
			});
		}

		// Add button (object/array only)
		if (this._btnAddItem) {
			this._btnAddItem.addEventListener('click', _ => {
				const count = this._hValue.childElementCount;
				const nextItem = count.toString();
				const name = this.type === 'object' ? `New Item ${nextItem}` : nextItem;
				// TODO: (QOL) Intelligent type detect? (Type of most other children)
				this._value!.addChild!('null', name, null);
			});
		}
	}

	private _setupValue(type: EditorType, value: JsonUnknown) {
		this._hValue.innerHTML = '';
		this._hValue.className = 'value-container';

		// Null value gets an empty div
		if (type !== 'null') {
			this._value = makeEditorValue({
				type: type as any,
				value: value as any,
				target: this._hValue,
				// Use a delegate to let value class make edits without knowing path
				delegate: (edit: JsonEdit) => {
					sendEdit({ ...edit, path: this.path });
				},
			});
		}

		// Set a CSS var that array children can reference to show their parent's name
		this._hValue.style.setProperty('--array-parent-name', `'${this.name}['`);

		this.rootElement.append(this._hValue);
	}

	//#endregion

	/** Editability for name (except for array members) */
	private _makeNameEditable() {
		this._hName.classList.add('fake-input');
		this._hName.contentEditable = 'plaintext-only';
		this._hName.role = 'textbox';
		this._hName.focus();

		const oldName = this._hName.textContent;
		const oldPath = this.path;

		let wasClosed = false;

		const onClose = () => {
			if (wasClosed) {
				return;
			}
			this._hName.classList.remove('fake-input');
			this._hName.contentEditable = 'false';
			this._hName.role = null;

			if (this._hName.textContent !== oldName) {
				if (!this._nameIsUnique(this._hName.textContent)) {
					errorMsg(
						`Something else on the same layer is already named "${this._hName.textContent}". Canceling edit.`,
					);
					this._hName.textContent = oldName;
					wasClosed = true;
					return;
				}

				this.makeDirty();

				// Strip newlines that get pasted in
				this._hName.textContent = this._hName.textContent?.replace('\n', '') ?? null;
				// Update name for children of arrays
				this._hValue.style.setProperty('--array-parent-name', `'${this.name}['`);

				sendEdit({ path: oldPath, type: 'Rename', newName: this._hName.textContent });
			}

			wasClosed = true;
		};

		this._hName.addEventListener('blur', onClose);

		this._hName.addEventListener('keydown', event => {
			switch (event.key) {
				case 'Escape':
					onClose();
					break;
				// Prevent newlines from Enter
				case 'Enter':
					event.preventDefault();
					event.stopPropagation();
					onClose();
					break;
			}
		});

		// Don't fold the details
		this._hName.addEventListener('keyup', event => {
			if (event.key === ' ') {
				event.preventDefault();
			}
		});
	}

	/**
	 * Figure out if a proposed name is taken by something else on the same layer.
	 *
	 * Two items within the same collection can't have the same name.
	 *
	 * @param name The name to test.
	 */
	private _nameIsUnique(name: string | null): boolean {
		let count = 0;

		for (const child of this._parent.children) {
			if (getItemName(child) === name) {
				count++;
			}
		}

		return count <= 1; // self gets counted
	}

	/**
	 * Swap this item with a neighbor using its "after" or "before" method.
	 *
	 * @param neighbor An Element, likely acquired by next/previousElementSibling
	 * @param inserter Neighbor's "before" or "after" method, with .bind(neighbor) called on
	 *   it to preserve context
	 * @todo Preserve the item's position on screen, like Colab
	 */
	private _moveNextTo(
		neighbor: Element | null,
		inserter: ((...nodes: (string | Node)[]) => void) | undefined,
	): boolean {
		if (neighbor && inserter) {
			inserter(this.rootElement);

			this.makeDirty();
			neighbor.dispatchEvent(new Event('make-dirty'));

			if (this._parentType === 'array') {
				this.rootElement.dispatchEvent(new Event('renumber'));
				neighbor.dispatchEvent(new Event('renumber'));
			}

			this.highlightAndScroll();
			return true;
			// sendEdit is done by a method with more information
		}
		return false;
	}

	//#endregion
}

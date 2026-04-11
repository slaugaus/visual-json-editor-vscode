import type { EditorValue } from '../../types/EditorValue';
import type { PartialEditDelegate } from '../../types/PartialEditDelegate';

export default class EditorBool implements EditorValue {
	constructor(
		initialValue: boolean | '',
		readonly rootElement: HTMLDivElement,
		private readonly _sendEdit: PartialEditDelegate,
	) {
		// Type change can pass ""
		if (initialValue === '') {
			initialValue = false;
		}
		this._setupHtml(initialValue);
		this._setupEvents();
	}

	// HTML parser used in the backend can't handle checkboxes
	// & dumping HTML doesn't preserve checkbox state anyway
	readonly realValue: HTMLSpanElement = document.createElement('span');

	private readonly _checkbox: HTMLInputElement = document.createElement('input');
	// Being inside a label makes realValue toggle the checkbox on click
	private readonly _label: HTMLLabelElement = document.createElement('label');
	// For customizing a checkbox in styles
	private readonly _fakeCheckbox: HTMLSpanElement = document.createElement('span');

	/**
	 * <label class="bool-label"> <input type="checkbox"/> <span
	 * class="fake-checkbox"></span> <span class="value">true</span> </label>
	 *
	 * @param value Initial bool value.
	 */
	private _setupHtml(value: boolean) {
		this._checkbox.type = 'checkbox';
		this._checkbox.checked = value;
		this._label.append(this._checkbox);

		this._fakeCheckbox.role = 'checkbox';
		this._fakeCheckbox.ariaChecked = value.toString();
		this._fakeCheckbox.className = 'fake-checkbox';
		this._label.append(this._fakeCheckbox);

		this.realValue.textContent = value.toString();
		this.realValue.className = 'value';
		this._label.append(this.realValue);

		this._label.className = 'bool-label';
		this.rootElement.append(this._label);

		this.rootElement.dispatchEvent(
			new CustomEvent('change-icon', {
				detail: value.toString(),
			}),
		);
	}

	private _setupEvents() {
		// oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional clobber?
		this._checkbox.onchange = _ => {
			const boxVal = this._checkbox.checked.toString();
			this.realValue.textContent = boxVal;

			this._sendEdit({ path: [''], type: 'contents', newValue: boxVal });

			this.rootElement.dispatchEvent(new Event('make-dirty'));

			this.rootElement.dispatchEvent(
				new CustomEvent('change-icon', {
					detail: boxVal,
				}),
			);
		};

		// Allow the parent (clickable icon) to toggle me
		this.rootElement.addEventListener('external-toggle', _ => {
			this._checkbox.checked = !this._checkbox.checked;
			this._checkbox.dispatchEvent(new Event('change'));
		});
	}
}

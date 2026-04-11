import type { EditorValue } from '../../types/EditorValue';
import type { PartialEditDelegate } from '../../types/PartialEditDelegate';

export default class EditorColor implements EditorValue {
	constructor(
		initialValue: string,
		readonly rootElement: HTMLDivElement,
		private readonly _sendEdit: PartialEditDelegate,
	) {
		// Type change can pass ""
		if (initialValue === '') {
			initialValue = '#000000';
		}
		this._setupHtml(initialValue);
		this._setupEvents();
	}

	readonly realValue: HTMLSpanElement = document.createElement('span');

	private readonly _picker: HTMLInputElement = document.createElement('input');

	private readonly _label: HTMLLabelElement = document.createElement('label');

	/*
	 * <label> <input type="color" value="$value"/> <span class="value">$value</span>
	 * </label>
	 */
	private _setupHtml(value: string) {
		this._picker.type = 'color';
		this._picker.value = value;

		this._label.append(this._picker);

		this.realValue.textContent = value;
		this.realValue.className = 'value';
		this._label.append(this.realValue);

		this.rootElement.append(this._label);
	}

	private _setupEvents() {
		this._picker.addEventListener('change', _ => {
			const newColor = this._picker.value;
			this.realValue.textContent = newColor;

			this._sendEdit({ path: [''], type: 'Contents', newValue: newColor });
			this.rootElement.dispatchEvent(new Event('make-dirty'));
		});
	}
}

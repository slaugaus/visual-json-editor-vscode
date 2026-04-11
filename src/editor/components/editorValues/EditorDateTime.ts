import type { EditorValue } from '../../types/EditorValue';
import type { PartialEditDelegate } from '../../types/PartialEditDelegate';

export default class EditorDateTime implements EditorValue {
	constructor(
		initialValue: string | number,
		readonly rootElement: HTMLDivElement,
		private readonly _sendEdit: PartialEditDelegate,
	) {
		// Type change can pass ""
		if (initialValue === '') {
			initialValue = Date.now();
		}
		this._setupHtml(initialValue);
		this._setupEvents();
	}

	readonly realValue: HTMLSpanElement = document.createElement('span');

	// input type=datetime-local
	private readonly _picker: HTMLInputElement = document.createElement('input');

	private readonly _label: HTMLLabelElement = document.createElement('label');

	private _setupHtml(value: string | number) {
		this._picker.type = 'datetime-local';
		this._picker.step = '0.001'; // adds second and millisecond fields

		const iso = new Date(value).toISOString();
		// annoyingly, datetime-local doesn't accept the trailing Z
		this._picker.value = iso.slice(0, 23);

		this._label.append(this._picker);

		this.realValue.textContent = iso;
		this.realValue.className = 'value';
		this._label.append(this.realValue);

		this.rootElement.append(this._label);
	}

	private _setupEvents() {
		this._picker.addEventListener('change', _ => {
			const iso = `${this._picker.value}Z`;

			this.realValue.textContent = iso;

			this._sendEdit({ path: [''], type: 'Contents', newValue: iso });
			this.rootElement.dispatchEvent(new Event('make-dirty'));
		});
	}
}

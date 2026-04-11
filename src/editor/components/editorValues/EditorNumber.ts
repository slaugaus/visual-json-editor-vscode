import { LosslessNumber, isLosslessNumber } from 'lossless-json';

import type { EditorValue } from '../../types/EditorValue';
import type { PartialEditDelegate } from '../../types/PartialEditDelegate';
import errorMsg from '../../utils/errorMsg';

export default class EditorNumber implements EditorValue {
	constructor(
		initialValue: number | LosslessNumber,
		readonly rootElement: HTMLDivElement,
		private readonly _sendEdit: PartialEditDelegate,
	) {
		this._setupHtml(initialValue);
		this._setupEvents();
	}

	private _setupHtml(value: number | LosslessNumber) {
		this.rootElement.textContent = isLosslessNumber(value)
			? value.value
			: value.toString();

		if (this.rootElement.textContent === '') {
			this.rootElement.textContent = '0';
		}
		this.rootElement.classList.add('value');
		this.rootElement.classList.add('editable-text');
	}

	private _setupEvents() {
		// Editability
		this.rootElement.addEventListener('click', () => {
			const oldValue = this.rootElement.textContent;
			this.rootElement.classList.add('fake-input');
			this.rootElement.contentEditable = 'plaintext-only';
			this.rootElement.role = 'textbox'; // A11y feature?

			this.rootElement.addEventListener('keydown', typeNumbersOnly);

			let wasClosed = false;

			this.rootElement.focus();

			const onClose = () => {
				if (wasClosed) {
					return;
				}
				this.rootElement.classList.remove('fake-input');
				this.rootElement.contentEditable = 'false';
				this.rootElement.role = null;

				// Nothing happened - done
				if (this.rootElement.textContent === oldValue) {
					wasClosed = true;
					return;
				}

				// Number validation and conversion
				// (Done immediately so editor never contains invalid JSON)
				// Empty/whitespace and extra 0s can fall back to 0
				if (/^[\s0]*$/.test(this.rootElement.textContent ?? '')) {
					this.rootElement.textContent = '0';
				} else {
					try {
						// Use LosslessNumber's validation
						this.rootElement.textContent = new LosslessNumber(
							this.rootElement.textContent ?? '0',
						).toString();
					} catch {
						errorMsg(`${this.rootElement.textContent} is not a number. Canceling edit.`);
						wasClosed = true;
						this.rootElement.textContent = oldValue;
						return;
					}
				}

				this.rootElement.dispatchEvent(new Event('make-dirty'));
				this._sendEdit({
					path: [''],
					type: 'Contents',
					newValue: this.rootElement.textContent,
				});

				wasClosed = true;
			};

			this.rootElement.addEventListener('blur', onClose);

			this.rootElement.addEventListener('keydown', event => {
				switch (event.key) {
					case 'Escape':
						onClose();
						break;
					case 'Enter':
						event.preventDefault();
						event.stopPropagation();
						onClose();
						break;
				}
			});
		});
	}
}

const typeNumbersOnly = (event: KeyboardEvent) => {
	// Navigation keys allowed
	if (
		event.key === 'Backspace' ||
		event.key === 'Delete' ||
		event.key === 'Tab' ||
		event.key === 'Escape' ||
		event.key === 'ArrowLeft' ||
		event.key === 'ArrowRight' ||
		event.key === 'Home' ||
		event.key === 'End'
	) {
		return;
	}

	// Block everything else but numbers, e (exponent), signs, and decimal point
	if (!/^[0-9eE\-+.]$/.test(event.key)) {
		event.preventDefault();
	}
};

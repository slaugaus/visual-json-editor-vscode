import type { EditorValue } from '../../types/EditorValue';
import type { PartialEditDelegate } from '../../types/PartialEditDelegate';

export default class EditorString implements EditorValue {
	constructor(
		initialValue: string,
		readonly rootElement: HTMLDivElement,
		private readonly _sendEdit: PartialEditDelegate,
	) {
		this._setupHtml(initialValue);
		this._setupEvents();
	}

	private _setupHtml(value: string) {
		this.rootElement.textContent = value;
		this.rootElement.classList.add('value');
		this.rootElement.classList.add('editable-text');
	}

	private _setupEvents() {
		// Editability
		this.rootElement.addEventListener('click', () => {
			const oldValue = this.rootElement.textContent;

			if (oldValue?.includes('\n')) {
				this.rootElement.classList.add('fake-textarea');
			} else {
				this.rootElement.classList.add('fake-input');
			}

			this.rootElement.contentEditable = 'plaintext-only';
			this.rootElement.role = 'textbox'; // A11y feature?

			let wasClosed = false;

			this.rootElement.focus();

			const onClose = () => {
				if (wasClosed) {
					return;
				}
				this.rootElement.classList.remove('fake-input', 'fake-textarea');
				this.rootElement.contentEditable = 'false';
				this.rootElement.role = null;

				if (this.rootElement.textContent !== oldValue) {
					this.rootElement.dispatchEvent(new Event('make-dirty'));
					this._sendEdit({
						path: [''],
						type: 'Contents',
						newValue: this.rootElement.textContent,
					});
				}

				wasClosed = true;
			};

			this.rootElement.addEventListener('blur', onClose);

			this.rootElement.addEventListener('keydown', event => {
				switch (event.key) {
					case 'Escape':
						onClose();
						break;
					case 'Enter':
						if (this.rootElement.classList.contains('fake-input')) {
							this.rootElement.classList.remove('fake-input');
							this.rootElement.classList.add('fake-textarea');
						}
						break;
				}
			});
		});
	}
}

import type { EditorType } from '@common/schema/EditorType';

import type { EditorValue } from '../../types/EditorValue';
import parseObject from '../../utils/parseObject';
import sendEdit from '../../utils/sendEdit';
import EditorItem from '../EditorItem';

/**
 * Class for both objects and arrays. The one meaningful difference between them (named
 * vs. indexed children) is handled in EditorItem.
 */
export default class EditorCollection implements EditorValue {
	constructor(
		private readonly _type: 'object' | 'array',
		initialValue: any,
		readonly rootElement: HTMLDivElement,
	) {
		this._setupHtml(initialValue);
	}

	addChild(itemType: EditorType, name: string, value: any) {
		const newChild = EditorItem.create(
			itemType,
			name,
			value,
			this.rootElement,
			this._type,
		);

		// does NOT use the delegate, since we're basing it on newChild's path which is known
		sendEdit({
			type: 'add',
			path: newChild.path,
			itemType,
			value,
			parentType: this._type,
		});

		this.rootElement.dispatchEvent(new Event('make-dirty'));
		newChild.makeDirty();
		newChild.highlightAndScroll();
	}

	private _setupHtml(initialValue: any) {
		parseObject(initialValue, this.rootElement);
		this.rootElement.classList.add('value');
	}
}

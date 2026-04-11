import { isLosslessNumber } from 'lossless-json';

import type { EditorType } from '@common/schema/EditorType';

import EditorItem from '../components/EditorItem';

/**
 * Where the magic (object -> HTML) happens!
 *
 * @param obj Deserialized JSON.
 * @param target The container to put the editor in.
 */
export default function parseObject(obj: any, target: HTMLElement) {
	const objType = detectType(obj);
	if (target.id === 'jsonContainer') {
		target.classList.add(objType);
	}

	Object.getOwnPropertyNames(obj).forEach(key => {
		if (key === 'length' && Array.isArray(obj)) {
			return;
		}

		const value = obj[key];
		const valueType = detectType(value);

		EditorItem.create(
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			valueType as EditorType,
			key,
			value,
			target,
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			objType as 'object' | 'array',
		);
	});
}

const detectType = (val: unknown) => {
	switch (typeof val) {
		case 'string':
			return detectSpecialString(val);
		case 'object':
			if (Array.isArray(val)) {
				return 'array';
			} else if (isLosslessNumber(val)) {
				return 'number';
			} else if (val === null) {
				return 'null';
			}
		default:
			return typeof val;
	}
};

const detectSpecialString = (val: string) => {
	if (/^#([0-9A-Fa-f]){6}$/.test(val)) {
		return 'color';
	} else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(val)) {
		return 'datetime';
	} else {
		return 'string';
	}
};

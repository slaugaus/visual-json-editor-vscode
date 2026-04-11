import type { UUID } from 'crypto';

import type { EditorHtml } from './EditorHtml';
import type { JsonEdit } from './JsonEdit';

/** A message sent **from** the editor. */
export type EditorMessage =
	| {
			type: 'Edit';
			edit: JsonEdit;
	  }
	| {
			type: 'DebugMsg' | 'ErrorMsg';
			message: string;
	  }
	| GetDataResponse
	| {
			type: 'Ready';
	  };

/** A response to a GetDataRequest. */
export type GetDataResponse = {
	type: 'GetDataResponse';
	requestId: UUID;
} & EditorHtml;

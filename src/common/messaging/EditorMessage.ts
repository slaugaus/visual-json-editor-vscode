import type { UUID } from 'crypto';

import type { EditorHtml } from './EditorHtml';
import type { JsonEdit } from './JsonEdit';

/** A message sent **from** the editor. */
export type EditorMessage =
	| {
			type: 'edit';
			edit: JsonEdit;
	  }
	| {
			type: 'debugMsg' | 'errorMsg';
			message: string;
	  }
	| GetDataResponse
	| {
			type: 'ready';
	  };

/** A response to a GetDataRequest. */
export type GetDataResponse = {
	type: 'getData_response';
	requestId: UUID;
} & EditorHtml;

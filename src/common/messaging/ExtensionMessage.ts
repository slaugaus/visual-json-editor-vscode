import { type UUID } from 'crypto';

import { type JsonEdit } from './JsonEdit';

/** A message sent **from** the extension. */
export type ExtensionMessage =
	| GetDataRequest
	| {
			type: 'document' | 'saved';
			content: unknown;
	  }
	| {
			type: 'change';
			changes: JsonEdit[];
	  };

/** The extension's request to read an editor's document. */
export type GetDataRequest = {
	type: 'getData';
	requestId: UUID;
};

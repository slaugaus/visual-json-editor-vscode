import type { JsonEdit } from '@common/messaging/JsonEdit';

/**
 * The two value-dependent parameters of sendEdit. EditorValues shouldn't be concerned
 * about the path to their parent EditorItem.
 */
export type PartialEditDelegate = (edit: JsonEdit) => void;

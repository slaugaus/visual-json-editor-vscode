/*
 * Types used in the Editor and Extension
 */

// TODO: extend this when messaging system is better defined?
// (a string literal can be a type)
/** Messages sent between the editor and extension */
export type Message<T = any> = {
    type: "edit" | string,
    requestId?: number,
    body?: T
};

/** HTML contents of jsonContainer and what type the loaded file was */
export type OutputHTML = {
    type: "object" | "array" | string,
    html: string
}

/** Edits made to a JsonDocument */
export interface JsonEdit<T = any> {
    readonly path: string[],
    readonly type: "contents" | "add" | "delete" | "rename",
    readonly change?: T,
}

/** 
 * The change for a JsonEdit of type "add". 
 * 
 * Parent and name information are already in JsonEdit.path;
 * these are the remaining items for the EditorItem constructor.
 */
export type EditAddition = {
    itemType: string,
    value: any,
    parentType: "object" | "array" | string,
}
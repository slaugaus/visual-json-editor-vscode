/*
 * Types used in the Editor and Extension
 */

/** Possible types of one item in the editor */
export const editorTypes = Object.freeze([
    "null",
    "string",
    "number",
    "boolean",
    "object",
    "array",

    // "datetime",   // input type="date"
    // "color",  // input type="color"
    // "import",   // paste JSON here (Monaco)
    // "upload", // convert to base64
]);

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
    type: "object" | "array",
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
    parentType: "object" | "array",
}
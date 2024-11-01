/*
 * Types used in the Editor and Extension
 */

/** Map of "special" types to their base type */
export const editorSubTypes = Object.freeze({
    datetime: "string", // input type="date"
    color: "string",    // input type="color"
    rawJson: "string",  // paste JSON here (Monaco)
    upload: "string"    // convert to base64
});

/** Possible types of one item in the editor */
export const editorTypes = Object.freeze([
    "null",
    "string",
    "number",
    "boolean",
    "object",
    "array",
    // unroll special types
    // ...(Object.keys(editorSubTypes))
]);

// TODO: extend this when messaging system is better defined?
// (a string literal can be a type)
/** Messages sent between the editor and extension */
export type Message<T = any> = {
    type: "edit" | string,
    requestId?: number,
    body?: T
};

export type ObjectOrArray = "object" | "array";

/** HTML contents of jsonContainer and what type the loaded file was */
export type OutputHTML = {
    type: ObjectOrArray,
    html: string
}

/** Edits made to a JsonDocument */
export interface JsonEdit<T = any> {
    readonly path: string[],
    readonly type: "contents" | "add" | "delete" | "rename" | "swap",

    // CONTENTS: The new value
    // ADD: An EditAddition
    // DELETE: Nothing
    // RENAME: The new name
    // SWAP: Path to what was swapped with
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
    parentType: ObjectOrArray,
}
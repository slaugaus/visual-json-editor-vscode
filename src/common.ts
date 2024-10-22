/*
 * Types used in the Editor and Extension
 */

// TODO: extend this when messaging system is better defined?
// (a string literal can be a type)
/**  */
export type Message<T> = {
    type: string,
    requestId?: number,
    body?: T
};

export type OutputHTML = {
    type: "object" | "array",
    html: string
}

export interface JsonEdit {
    readonly path: string[],
    readonly type: "contents" | "add" | "delete" | "rename",
    readonly change: any,
}
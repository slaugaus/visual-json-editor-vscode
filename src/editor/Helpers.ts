import { editorTypes, JsonEdit, JsonEditType, ObjectOrArray } from "../common";
import { EditorItem } from "./EditorItem";
import { vscode } from "./vscode-webview";

/**
 * Items originally in the global scope of editor.js.
 * 
 * Potentially used by both main and EditorItem, or otherwise
 * inappropriate for inclusion in EditorItem.
 */
export abstract class Helpers {

    static readonly jsonContainer = document.getElementById("jsonContainer")!;

    static readonly codiconMap: { [key: string]: string } = Object.freeze({
        // JSON Types
        string: "codicon codicon-quote",
        number: "codicon codicon-symbol-number",
        boolean: "codicon codicon-circle-large-outline",
        null: "codicon codicon-question",
        array: "codicon codicon-array",
        object: "codicon codicon-symbol-object",
        // Other Useful
        true: "codicon codicon-pass-filled",
        false: "codicon codicon-circle-large-outline",
        dirty: "codicon codicon-close-dirty",
    });

    /** What types (self included) can a given type safely convert to? */
    static readonly validConversions: { [key: string]: readonly string[]} = Object.freeze({
        string: ["string"],
        number: ["number", "string"],
        boolean: ["boolean", "string"],
        array: ["array", /*"import"*/],
        object: ["object", /*"import"*/],
        null: editorTypes,  // any
    });

    //#region Messaging Shorthand

    /**
     * Notify the extension that an edit was made.
     * @param path Path to the modified item (getPathToItem return value)
     * @param type Type of the edit
     * @param change Info about the change made
     */
    static sendEdit<T = any>(
        path: string[],
        type: JsonEditType,
        change?: T,
    ): void {
        vscode.postMessage<JsonEdit<T>>({
            type: "edit",
            body: { path, type, change }
        });
    }

    /**
     * Send the extension a message with debugging info (which it displays and prints).
     */
    static debugMsg(msg: string): void {
        vscode.postMessage({
            type: "debug",
            body: msg,
        });
    }

    /**
     * Send the extension an error message to display.
     */
    static errorMsg(msg: string): void {
        vscode.postMessage({
            type: "error",
            body: msg,
        });
    }

    //#endregion

    /**
     * Sanitize and encode all HTML in a user-submitted string
     * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
     * @param  {String} str  The user-submitted string
     * @return {String} The sanitized string
     */
    static sanitizeHTML(str: string): string {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
    }

    /**
     * Create a Codicon <i> from the map or the string directly.
     * @param {String} name 
     * @returns {HTMLElement} \<i class="key">\</i>
     */
    static codicon(name: string): HTMLElement {
        const icon = document.createElement("i");
        if (this.codiconMap.hasOwnProperty(name)) {
            icon.className = this.codiconMap[name];
        } else {
            icon.className = `codicon codicon-${name}`;
        }
        return icon;
    }

    /** 
     * typeof null or Array is object. Handle that case and fall back to typeof.
     */
    static jsonTypeOf(val: any) {
        switch (typeof val) {
            case "object":
                if (val instanceof Array) {
                    return "array";
                } else if (val === null) {
                    return "null";
                }
            // else return "object";
            default:
                return typeof val;
        }
    }

    /**
     * Where the magic (object -> HTML) happens!
     * @param {any} obj Deserialized JSON
     * @param {HTMLElement} target Container to hold the object
     */
    static parseObject(obj: any, target: HTMLElement) {
        const objType = this.jsonTypeOf(obj);
        // The root object can be an array [] or object {}
        if (target.id === "jsonContainer") {
            target.classList.add(objType);
        }

        Object.getOwnPropertyNames(obj).forEach(key => {
            // Ignore array's length property (pretend we're not just treating it like an object)
            if (key === "length" && obj instanceof Array) {
                return;
            }

            const value = obj[key];
            const valueType = this.jsonTypeOf(value);

            new EditorItem(valueType, key, value, target, objType as ObjectOrArray);
        });
    }

    /**
     * Parse value based on its type, then place it inside target
     */
    static parseValueInto(target: HTMLElement, value: any, type?: string): void {
        // In case we haven't typed it already
        if (!type) {
            type = this.jsonTypeOf(value);
        }

        let returnVal;

        switch (type) {
            case "string":
                returnVal =  this.sanitizeHTML(value);
                break;
            case "number":
            case "boolean":
                returnVal = value;
                break;
            case "null":
                // returnVal = "(null)";
                break;
            // Woo recursion!
            case "array":
            case "object":
                this.parseObject(value, target);
                return;
        }

        if (returnVal) {
            target.innerHTML = returnVal as string;
        }
    }

    //#region Item Paths

    /** 
     * @param {Element} item 
     * @returns {string | null | undefined}
     */
    static getItemName(item: Element): string | null | undefined {
        // :scope> means "must be a direct child"
        return item.querySelector(":scope>.key")?.querySelector(":scope>.name")?.textContent;
    }

    /**
     * From a path made by getPathToItem, retrieve the item it's pointing to.
     * @param {string[]} path List of JSON keys, in order
     * @todo Consider optimizing/making recursive?
     * @todo Is the deepest item it finds a good failsafe?
     */
    static getItemFromPath(path: string[]): Element {
        let target: Element = document.querySelector("#jsonContainer")!;
        // Advance through the item names
        for (const itemName of path) {
            // If target isn't already a collection of items (.value or jsonContainer),
            // get that collection
            const searchTarget = target.querySelector(":scope>.value") ?? target;

            loop2: for (const item of Array.from(searchTarget.children)) {
                // Got the root item, onto the next child
                if (itemName === this.getItemName(item)) {
                    target = item;
                    break loop2;    // break out of only this for loop
                }
            }
        }

        return target;
    }

    /**
     * Trace item's lineage up to (not including) jsonContainer.
     * @param {Element} item A details.item
     * @param {string[]} path Used in recursion
     * @returns {string[]} Path to the item
     */
    static getPathToItem(item: Element, path: string[] = []): string[] {

        const name = this.getItemName(item);
        if (name) {
            path.unshift(name); // prepend
        }

        let parent;
        if (item.parentElement!.id !== "jsonContainer"
            && item.parentElement instanceof HTMLDivElement) {
            parent = item.parentElement.parentElement;
        }
        else {
            parent = item.parentElement;
        }

        if (item.parentElement!.id === "jsonContainer") {
            return path;
        }
        else if (parent) {
            this.getPathToItem(parent, path);
        }

        return path;
    }

    //#endregion

    /** Remove the "changed"/"dirty" indicators from everything that has it */
    static cleanChanged() {
        document.querySelectorAll(".item.changed").forEach(
            item => item.classList.remove("changed"));

        document.querySelectorAll(".dirty-indicator").forEach(
            item => (item as HTMLElement).style.display = "none");
    }
}
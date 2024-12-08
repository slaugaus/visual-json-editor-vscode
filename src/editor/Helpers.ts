import { isLosslessNumber, LosslessNumber } from "lossless-json";
import { EditAddition, editorTypes, JsonEdit, JsonEditType, ObjectOrArray, SomethingFromJson } from "../common";
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
        // Extra Types
        color: "codicon codicon-paintcan",
        datetime: "codicon codicon-calendar",
    });

    /** What types (self included) can a given type safely convert to? */
    static readonly validConversions: { [key: string]: readonly string[] } = Object.freeze({
        string: ["string"],
        number: ["number", "string"],
        boolean: ["boolean", "string"],
        array: ["array"],   // TODO: array to object is safe but needs special handling
        object: ["object"],
        color: ["color", "string"],
        datetime: ["datetime", "string"],
        null: editorTypes,  // any
    });

    /**
     * If true, changes to the object won't be reported to the extension backend.
     * 
     * Used when playing back edits.
     */
    static ignoreEdits = false;

    //#region Messaging Shorthand

    /**
     * Notify the extension that an edit was made.
     * @param path Path to the modified item (getPathToItem return value)
     * @param type Type of the edit
     * @param change Info about the change made, see common.ts for details.
     */
    static sendEdit<T = any>(
        path: string[],
        type: JsonEditType,
        change?: T,
    ): void {
        if (!this.ignoreEdits) {
            vscode.postMessage<JsonEdit<T>>({
                type: "edit",
                body: { path, type, change }
            });
        }
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
     * Create a Codicon element from the map or the string directly.
     * @param {String} name 
     * @param {String} [elementType="i"] An HTML element name compatible with
     *     document.createElement() - in case \<i> isn't good enough
     * @returns {HTMLElement} \<i class="key">\</i>
     */
    static codicon(name: string, elementType: string = "i"): HTMLElement {
        const icon = document.createElement(elementType);
        if (this.codiconMap.hasOwnProperty(name)) {
            icon.className = this.codiconMap[name];
        } else {
            icon.className = `codicon codicon-${name}`;
        }
        return icon;
    }

    static detectType(val: any) {
        switch (typeof val) {
            case "string":
                return this.detectSpecialString(val);
            case "object":
                // typeof gives "object" for arrays and null
                if (val instanceof Array) {
                    return "array";
                } else if (isLosslessNumber(val)) {
                    return "number";
                } else if (val === null) {
                    return "null";
                } // Else, fall through
            default:
                return typeof val;
        }
    }

    static detectSpecialString(val: string)  {
        // Colors (input type color only supports 6-digit hex)
        // TODO: Other formats?
        if (/^#([0-9A-Fa-f]){6}$/.test(val)) {
            return "color";
        }
        // Datetimes specifically YYYY-MM-DDThh:mm:ss.sssZ format
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(val)) {
            return "datetime";
        }
        // Base64?
        else {
            return "string";
        }
    }

    /**
     * Where the magic (object -> HTML) happens!
     * @param {any} obj Deserialized JSON
     * @param {HTMLElement} target Container to hold the object
     */
    static parseObject(obj: any, target: HTMLElement) {
        const objType = this.detectType(obj);
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
            const valueType = this.detectType(value);

            EditorItem.create(valueType, key, value, target, objType as ObjectOrArray);
        });
    }

    //#region Item Paths

    /** 
     * @param {Element} item 
     * @returns {string | null | undefined}
     */
    static getItemName(item: Element): string | null | undefined {
        // :scope> means "must be a direct child"
        return item.querySelector(":scope>.key>.name")?.textContent;
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
    }

    /** 
     * Make all the changes described in an array of edits.
     * 
     * Thanks to {@link Helpers.ignoreEdits}, some edit types can be applied just by
     * triggering the same events a user would!
     */
    static playbackEdits(edits: JsonEdit[]) {
        console.log("PLAYING BACK EDITS...");
        this.ignoreEdits = true;

        try {
            edits.forEach(edit => {
                const target = this.getItemFromPath(edit.path);
                switch (edit.type) {
                    case "contents": {
                        console.log(`  CONTENTS - [${edit.path.join(", ")}] -> ${edit.change}`);
                        this.setValueOfItem(target, edit.change);
                        break;
                    }

                    case "add": {
                        // TODO: Additions are always null, innit?
                        console.log(`  ADD - [${edit.path.join(", ")}] -> ${JSON.stringify(edit.change)}`);
                        const addition: EditAddition = edit.change!;
                        // Item name is the last path item
                        const name = edit.path.pop()!;
                        const parent = (edit.path.length === 0)
                            // for top-level items
                            ? this.jsonContainer
                            // for objects/arrays - we're appending to the value div
                            // (relies on getItemFromPath ignoring invalid names)
                            : target.querySelector(".value") as HTMLElement;
                        const newThing = EditorItem.create(
                            addition.itemType, name, addition.value,
                            parent, addition.parentType);
                        newThing.makeDirty();
                        break;
                    }

                    case "delete": {
                        console.log(`  DELETE - [${edit.path.join(", ")}] -> ${edit.change}`);
                        // Press delete button, since it triggers an array renumber
                        target.querySelector(".delete-btn")?.dispatchEvent(new Event("click"));
                        break;
                    }

                    case "rename": {
                        console.log(`  RENAME - [${edit.path.join(", ")}] -> ${edit.change}`);
                        target.querySelector(":scope>.key>.name")!.textContent = edit.change;
                        // Update name for arrays
                        (target.querySelector(":scope>.value") as HTMLElement)
                            ?.style.setProperty("--array-parent-name", `'${edit.change}['`);
                        break;
                    }

                    case "move": {
                        console.log(`  MOVE - [${edit.path.join(", ")}] -> ${edit.change}`);
                        // Trigger the up/down button
                        target.querySelector(`.${edit.change}-btn`)?.dispatchEvent(new Event("click"));
                        break;
                    }

                    case "type": {
                        console.log(`  TYPE - [${edit.path.join(", ")}] -> ${edit.change}`);
                        // If null, trigger clear button
                        if (edit.change === "null") {
                            target.querySelector(".clear-btn")?.dispatchEvent(new Event("click"));
                        } else {
                            // Set the <select> and trigger its onchange
                            const dropdown = target.querySelector("select") as HTMLSelectElement;
                            dropdown.value = edit.change;
                            dropdown.dispatchEvent(new Event("change"));
                        }
                        break;
                    }
                }
            });
        } finally { // Failsafe
            this.ignoreEdits = false;
            console.log("END EDIT PLAYBACK\n");
        }
    }

    static setValueOfItem(item: Element, value: SomethingFromJson) {
        const type = (item.querySelector(":scope>.key>.type")! as HTMLSelectElement).value;

        switch (type) {
            case "string":
            case "number":
                item.querySelector(":scope>.value")!.textContent = value as string;
                break;
            // THE LABELED-INPUT BROTHERS
            case "boolean":
            case "color":
            case "datetime": {
                const input = item.querySelector(":scope>.value-container>label>input")! as HTMLInputElement;
                if (type === "boolean") {
                    input.checked = (value === "true");
                } else if (type === "datetime") {
                    input.value = (value as string).replace("Z", "");
                } else {
                    input.value = value as string;
                }
                // Since ignoreEdits is true, this won't mess up the undo stack
                input.dispatchEvent(new Event("change"));
                break;
            }
            // Object, array, and null don't have their contents set directly
            default:
                console.error(`    !TYPE UNIMPLEMENTED!`);
                break;
        }
    }
}
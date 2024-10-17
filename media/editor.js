//@ts-check
// (JS but TypeScript-ness is in the comments...)
"use strict";

// Limit scope/namespacing(?)
(function () {

// Grab the VS Code API for messaging
//@ts-ignore
const vscode = acquireVsCodeApi();

/**
 * Sanitize and encode all HTML in a user-submitted string
 * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {String} str  The user-submitted string
 * @return {String} The sanitized string
 */
function sanitizeHTML(str) {
    var temp = document.createElement("div");
    temp.textContent = str;
    return temp.innerHTML;
}

// const validBaseTypes = [
//     "string",
//     "number",
//     "boolean",
//     "null",
//     "array",
//     "object",
// ];

/** @type {HTMLDivElement} */
//@ts-ignore
var jsonContainer = document.querySelector("#jsonContainer");

/** 
 * typeof null or Array is object. Handle that case and fall back to typeof.
 * @param {any} val 
 */
function jsonType(val) {
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

class EditorItem {

    get name() {
        return this.#name.textContent;
    }

    set name(val) {
        this.#name.textContent = val;
    }

    get type() {
        return this.#type.textContent;
    }

    set type(val) {
        this.#type.textContent = val;
    }

    get value() {
        return this.#value.innerHTML;
    }

    set value(val) {
        this.#value.innerHTML = val;
    }

    // I wanted to cache this after the final appendChild,
    // but that doesn't work for no clear reason
    get path() {
        return getPathToItem(this.#root);
    }

    /**
     * @param {String} type
     * @param {String} name
     * @param {any} value
     * @param {HTMLElement} parent
    */
    constructor(type, name, value, parent) {
        this.#createHtml(type, name, value, parent);

        this.#setupEvents();
    }

    static #iconMap = {
        string: "codicon codicon-quote",
        number: "codicon codicon-symbol-number",
        boolean: "codicon codicon-getting-started-item-checked",
        null: "codicon codicon-question",
        array: "codicon codicon-array",
        object: "codicon codicon-symbol-object"
    };

    /**
     * Initialize my HTML, then append to a parent element
     * @param {String} type
     * @param {String} name
     * @param {any} value
     * @param {HTMLElement} parent
     */
    #createHtml(type, name, value, parent) {
        // <details> (main container)
        this.#root = document.createElement("details");
        this.#root.className = `item ${type}`;
        this.#root.open = true;

        // <summary> (key and type)
        this.#label = document.createElement("summary");
        this.#label.className = "key";
        this.#label.innerHTML = `<i class="${EditorItem.#iconMap[type]}"></i> `;
        this.#root.appendChild(this.#label);

        // name/key of item (inside label)
        this.#name = document.createElement("span");
        this.#name.className = "name";
        this.#name.textContent = name;
        this.#label.appendChild(this.#name);

        this.#label.innerHTML += " ";

        // type of item (inside label)
        this.#type = document.createElement("span");
        this.#type.className = "type";
        this.#type.textContent = type;
        this.#label.appendChild(this.#type);

        // TODO: temp items
        this.#whoAmI = document.createElement("button");
        this.#whoAmI.type = "button";
        this.#whoAmI.innerHTML = '<i class="codicon codicon-search"></i>';
        this.#whoAmI.className = "debug-btn";
        this.#root.appendChild(this.#whoAmI);

        // value (could be another object/array)
        this.#value = document.createElement("div");
        this.#value.className = "value";

        // Preserve the events of child object/arrays
        if (type === "object" || type === "array") {
            //@ts-ignore
            this.#value.append(...parseValue(value, type).children);
        } else {
            //@ts-ignore
            this.#value.innerHTML = parseValue(value, type);
        }

        this.#root.appendChild(this.#value);

        parent.appendChild(this.#root);

        // this.#path = getPathToItem(this.#root);
    }

    // /** @type {string[]} */ #path;

    // The HTML comprising this item:
    /** @type {HTMLDetailsElement} */ #root;
    /** @type {HTMLElement} */ #label;
    /** @type {HTMLSpanElement} */ #name;
    /** @type {HTMLSpanElement} */ #type;
    /** @type {HTMLDivElement} */ #value;

    // TODO: temp items
    /** @type {HTMLButtonElement} */ #whoAmI;

    #setupEvents() {

        // TODO: children of a summary aren't receptive to clicks...
        this.#name.onclick = (event) => {
            event.stopPropagation();
            this.#makeEditable(this.#name);
        };

        this.#value.onclick = (event) => {
            if (this.type === "string") {
                this.#makeEditable(this.#value);
            }
        };

        this.#whoAmI.onclick = (event) => {
            const identity = this.path.join(".");

            const myself = getItemFromPath(this.path);
            const itWorked = myself === this.#root;

            vscode.postMessage({
                type: "debug",
                body: `You clicked on ${identity}!\n  Did getItemFromPath work? ${itWorked}`
            });
        };
    }

    /**
     * @param {HTMLElement} element
     */
    #makeEditable(element) {
        element.hidden = true;

        const input = document.createElement("input");
        input.type = "text";
        input.value = element.textContent ?? "";

        element.after(input);
        input.focus();

        input.onblur = () => {
            element.hidden = false;
            element.textContent = input.value;

            vscode.postMessage({
                type: "edit",
                body: {
                    path: this.path,
                    type: "contents",
                    change: element.textContent
                }
            });

            input.remove();
        };
    }
}

/**
 * Where the magic (object -> HTML) happens
 * @param {any} obj Deserialized JSON
 * @param {HTMLElement} target Container to hold the object
 */
function parseObject(obj, target) {
    // The root object can be an array [] or object {}
    if (target.id === "jsonContainer") {
        jsonContainer.className = jsonType(obj);
    }

    Object.getOwnPropertyNames(obj).forEach((key) => {
        // Ignore array's length property (pretend we're not just treating it like an object)
        if (key === "length" && obj instanceof Array) {
            return;
        }

        const value = obj[key];
        const valueType = jsonType(value);

        // TODO: You made this a class, but is there a good reason for it to be one?
        new EditorItem(valueType, key, value, target);
    });
}

/**
 * Where more of the magic happens! (Parse a value for parseObject)
 * @param {any} value
 * @param {string|null} type 
 * @returns {string|number|boolean|HTMLDivElement|void}
 */
function parseValue(value, type = null) {
    // In case we haven't typed it already
    if (type === null) {
        type = jsonType(value);
    }

    switch (type) {
        case "string":
            return sanitizeHTML(value);
        case "number":
        case "boolean":
            return value;
        case "null":
            return "(null)";
        // Woo recursion!
        case "array":
        case "object":
            const childObj = document.createElement("div");
            parseObject(value, childObj);
            return childObj;
    }
}

/** 
 * @param {Element} item 
 * @returns {string | null | undefined}
 */
function getItemName(item) {
    // :scope> means "must be a direct child"
    return item.querySelector(":scope>.key")?.querySelector(":scope>.name")?.textContent;
}

/**
 * From a path made by getPathToItem, retrieve the item it's pointing to.
 * @param {string[]} path List of JSON keys, in order
 * @returns {Element}
 * @todo Consider optimizing?
 * @todo Is the deepest item it finds a good failsafe?
 */
function getItemFromPath(path) {
    /** @type {Element} */
    let target = jsonContainer;
    // Advance through the item names
    for (const itemName of path) {

        const value = target.querySelector(":scope>.value");

        let searchTarget;
        if (value) {
            // Target is an .item - search its .value
            searchTarget = value;
        }
        else {
            searchTarget = target;
        }

        loop2: for (const item of searchTarget.children) {
            // Got the root item, onto the next child
            if (itemName === getItemName(item)) {
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
function getPathToItem(item, path = []) {
    
    const name = getItemName(item);
    if (name) {
        path.unshift(name); // prepend
    }

    let parent;
    if (item.parentElement !== jsonContainer
        && item.parentElement instanceof HTMLDivElement) {
        parent = item.parentElement.parentElement;
    }
    else {
        parent = item.parentElement;
    }
    
    if (item.parentElement === jsonContainer) {
        return path;
    }
    else if (parent) {
        getPathToItem(parent, path);
    }

    return path;
}

//#region Messaging

// Message Handler
window.addEventListener('message', (/** @type {MessageEvent<{type: String, requestId?: Number, body: any}>} */ event) => {
    const message = event.data;
    switch (message.type) {
        case "doc":
            jsonContainer.textContent = null;
            parseObject(message.body, jsonContainer);
            // vscode.setState(something);
            return;

        case "getData":
            vscode.postMessage({
                type: "responseReady",
                requestId: message.requestId,
                body: {
                    "type": jsonContainer.className,
                    "html": jsonContainer.innerHTML
                }
            });
            return;

        // TODO: change

        default:
            vscode.postMessage({
                type: "debug",
                body: `Editor received unknown message: ${message.type}`
            });
            return;
    }
});

//#endregion

// TODO: Try out state recovery
// (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate)
// const lastState = vscode.getState();
// if (lastState) {}

let newThingId = 0;

//@ts-ignore
document.getElementById("rootPlus").onclick = (e) => {
    const newThing = new EditorItem("string", `New Thing ${newThingId++}`, "I'm new!", jsonContainer);
    vscode.postMessage({
        type: "edit",
        body: {
            path: newThing.path,
            type: "add",
            change: newThing
        }
    });
};

vscode.postMessage({ type: "ready" });

}());

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
        this.#root.className = `entry ${type}`;
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

        // value (could be another object/array)
        this.#value = document.createElement("div");
        this.#value.className = "value";
        this.#value.innerHTML = parseValue(value, type);

        this.#root.appendChild(this.#value);

        parent.appendChild(this.#root);
    }

    // The HTML comprising this item:
    /** @type {HTMLDetailsElement} */ #root;
    /** @type {HTMLElement} */ #label;
    /** @type {HTMLSpanElement} */ #name;
    /** @type {HTMLSpanElement} */ #type;
    /** @type {HTMLDivElement} */ #value;

    #setupEvents() {

        // TODO: children of a summary aren't receptive to clicks...
        this.#name.onclick = (event) => {
            event.stopPropagation();
            EditorItem.#makeEditable(this.#name);
        };

        this.#value.onclick = (event) => {
            if (this.type === "string") {
                EditorItem.#makeEditable(this.#value);
            }
        };
    }

    /**
     * @param {HTMLElement} element
     */
    static #makeEditable(element) {
        element.hidden = true;

        const input = document.createElement("input");
        input.type = "text";
        input.value = element.textContent ?? "";

        element.after(input);
        input.focus();

        input.onblur = () => {
            element.hidden = false;
            element.textContent = input.value;
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
            return childObj.innerHTML;
    }
}

//@ts-ignore
document.getElementById("rootPlus").onclick = (e) => {
    new EditorItem("string", "New Thing", "I'm new!", jsonContainer);
};

//#region Messaging

// Message Handler
window.addEventListener('message', (/** @type {MessageEvent<{type: String, requestId: Number, body: any}>} */ event) => {
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
    }
});

//#endregion

// TODO: Try out state recovery
// (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate)
// const lastState = vscode.getState();
// if (lastState) {}

vscode.postMessage({ type: "ready" });

}());
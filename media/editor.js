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

/** 
 * For keydown events, block anything that's not a number.
 * 
 * (Because I want to use the fancy fake inputs)
 * @param {KeyboardEvent} event 
 */
function typeNumbersOnly(event) {
    /** @type Element */ //@ts-ignore
    const caller = event.target;
    const currentText = caller.textContent ?? "";

    if (event.key === "Backspace"
        || event.key === 'Delete'
        || event.key === 'Tab'
        || event.key === 'Escape'
        || event.key === "ArrowLeft"
        || event.key === "ArrowRight"
        || (event.key === '.' && !currentText.includes('.'))
        || (event.key === 'e' && !currentText.includes('e'))
        || (event.key === '+' && !currentText.includes('+'))
    ) { return; }

    // If it's not a number (0-9) or the key is not allowed, prevent input
    if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault();
    }
}

/**
 * For paste events, block anything that's not a number.
 * @param {ClipboardEvent} event 
 */
function pasteNumbersOnly(event) {
    /** @type Element */ //@ts-ignore
    const caller = event.target;

    const currentText = caller.textContent ?? "";
    const paste = event.clipboardData?.getData('text') ?? "";

    // Prevent paste if it contains non-numeric characters or more than one decimal point
    if (!/^\d*\.?\d*$/.test(paste) || (paste.includes('.') && currentText.includes('.'))) {
        event.preventDefault();
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
     * @param {String} parentType 
    */
    constructor(type, name, value, parent, parentType) {
        this.#parentType = parentType;

        this.#createHtml(type, name, value, parent);

        this.#setupEvents();
    }

    static #iconMap = {
        string: "codicon codicon-quote",
        number: "codicon codicon-symbol-number",
        boolean: "codicon codicon-primitive-square",
        null: "codicon codicon-question",
        array: "codicon codicon-array",
        object: "codicon codicon-symbol-object",

        true: "codicon codicon-pass-filled",
        false: "codicon codicon-circle-large-outline",
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
        this.#root.appendChild(this.#label);

        // <i> (Codicon inside label)
        this.#icon = document.createElement("i");
        this.#icon.className = EditorItem.#iconMap[type];
        this.#label.appendChild(this.#icon);

        // name/key of item (inside label)
        this.#name = document.createElement("span");
        this.#name.className = "name clickable";
        this.#name.textContent = name;
        this.#label.appendChild(this.#name);

        // type of item (inside label)
        this.#type = document.createElement("span");
        this.#type.className = "type clickable";
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

        // Type-specific items
        if (type === "boolean") {
            this.#checkbox = document.createElement("input");
            this.#checkbox.type = "checkbox";
            this.#checkbox.checked = this.value === "true";
            this.#icon.className = EditorItem.#iconMap[this.value];
            this.#value.before(this.#checkbox);
        }

        parent.appendChild(this.#root);
    }

    /** Whether the parent is an obj or array. Needed for renaming
     *  @type {string} */ #parentType;

    // The HTML comprising this item:
    /** @type {HTMLDetailsElement} */ #root;
    /** @type {HTMLElement} */ #label;
    /** @type {HTMLElement} */ #icon;
    /** @type {HTMLSpanElement} */ #name;
    /** @type {HTMLSpanElement} */ #type;
    /** @type {HTMLDivElement} */ #value;

    // Type-specific items
    /** @type {HTMLInputElement} */ #checkbox;

    // TODO: temp items
    /** @type {HTMLButtonElement} */ #whoAmI;

    #setupEvents() {

        this.#name.addEventListener("click", event => {
            if (this.#parentType === "object") {
                event.stopPropagation();
                event.preventDefault();
                this.#makeNameEditable();
            }
        });

        this.#value.onclick = event => {
            switch (this.type) {
                case "string":
                case "number":
                    this.#makeStringEditable(this.#value);
                    break;
                case "boolean":
                    this.#checkbox.checked = !this.#checkbox.checked;
                    this.#checkbox.dispatchEvent(new Event("change"));
                    break;
            }
        };

        if (this.#checkbox) {
            this.#checkbox.onchange = event => {
                const tf = this.#checkbox.checked.toString();
                this.#value.textContent = tf;

                this.#root.classList.add("changed");

                this.#icon.className = EditorItem.#iconMap[tf];

                vscode.postMessage({
                    type: "edit",
                    body: {
                        path: this.path,
                        type: "contents",
                        change: this.#value.textContent
                    }
                });
            };

            this.#icon.onclick = event => {
                event.stopPropagation();
                event.preventDefault();
                this.#checkbox.checked = !this.#checkbox.checked;
                this.#checkbox.dispatchEvent(new Event("change"));
            };
        }

        this.#whoAmI.onclick = event => {
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
     * Editability for string and number
     * @param {HTMLElement} element
     * @param {boolean} [allowNewline=true]
     */
    #makeStringEditable(element, allowNewline = true) {
        element.hidden = true;
        element.style.display = "none";
        
        // TODO: May be mildly overengineered now that it's using fake-input.
        // Putting the cursor at the click position also doesn't work b/c of this
        const input = document.createElement("span");
        input.textContent = element.textContent ?? "";
        input.contentEditable = "plaintext-only";

        if (this.type === "number"){
            allowNewline = false;
            input.addEventListener("keydown", typeNumbersOnly);
            input.addEventListener("paste", pasteNumbersOnly);
        }

        if (allowNewline && input.textContent.includes("\n")){
            input.className = "fake-textarea value editor string";
        } else {
            input.className = "fake-input value editor string";
            input.style.display = "initial";
        }
        
        element.after(input);
        input.focus();

        let wasClosed = false;
        
        const onClose = () => {
            if (wasClosed) { return; }  // Run once
            element.hidden = false;
            element.style.display = "block";

            // TODO: Validate number

            // Did it actually change?
            if (element.textContent !== input.textContent) {
                element.textContent = input.textContent;

                this.#root.classList.add("changed");

                vscode.postMessage({
                    type: "edit",
                    body: {
                        path: this.path,
                        type: "contents",
                        change: element.textContent
                    }
                });
            }
            wasClosed = true;
            input.remove();
        };

        // On focus lost (click something else or tab away)
        input.onblur = onClose;

        input.addEventListener("keydown", event => {
            switch (event.key) {
                case "Escape":
                    onClose();
                    break;
                // Become a fake textarea if newlines are introduced
                case "Enter":
                    if (allowNewline && input.classList.contains("fake-input")) {
                        input.classList.remove("fake-input");
                        input.style.display = "block";
                        input.classList.add("fake-textarea");
                    } else if (!allowNewline) {
                        onClose();
                    }
                    break;
            }
        });
    }

    // TODO: Common reusable makeEditable function
    #makeNameEditable() {
        this.#name.classList.add("fake-input");
        this.#name.contentEditable = "plaintext-only";
        this.#name.focus();

        const oldName = this.#name.textContent;

        let wasClosed = false;
        
        const onClose = () => {
            if (wasClosed) { return; }
            this.#name.classList.remove("fake-input");
            this.#name.contentEditable = "false";

            if (this.#name.textContent !== oldName) {
                this.#root.classList.add("changed");

                // Strip newlines that get pasted in
                this.#name.textContent = (this.#name.textContent?.replace("\n", "") ?? null);

                vscode.postMessage({
                    type: "edit",
                    body: {
                        path: this.path,
                        type: "rename",
                        change: this.#name.textContent
                    }
                });
            }

            wasClosed = true;
        };

        this.#name.onblur = onClose;

        this.#name.onkeydown = event => {
            switch (event.key) {
                case "Escape":
                    onClose();
                    break;
                // Prevent newlines from Enter
                case "Enter":
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                    break;
            }
        };
    }
}

/**
 * Where the magic (object -> HTML) happens
 * @param {any} obj Deserialized JSON
 * @param {HTMLElement} target Container to hold the object
 */
function parseObject(obj, target) {
    const objType = jsonType(obj);
    // The root object can be an array [] or object {}
    if (target.id === "jsonContainer") {
        jsonContainer.classList.add(objType);
    }

    Object.getOwnPropertyNames(obj).forEach(key => {
        // Ignore array's length property (pretend we're not just treating it like an object)
        if (key === "length" && obj instanceof Array) {
            return;
        }

        const value = obj[key];
        const valueType = jsonType(value);

        // TODO: You made this a class, but is there a good reason for it to be one?
        new EditorItem(valueType, key, value, target, objType);
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

/** Remove the "changed" indicator from everything that has it */
function cleanChanged() {
    document.querySelectorAll(".item.changed").forEach(
        item => item.classList.remove("changed"));
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

        case "saved":
            cleanChanged();
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
document.getElementById("rootPlus").onclick = event => {
    const newThing = new EditorItem("string", `New Thing ${newThingId++}`, "I'm new!", jsonContainer, "object");
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

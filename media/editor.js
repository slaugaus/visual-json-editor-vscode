//@ts-check
// (JS but TypeScript-ness is in the comments...)

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
 * Where the magic (object -> HTML) happens
 * @param {any} obj Deserialized JSON
 * @param {HTMLElement} target Container to hold the object
 */
function parseObject(obj, target) {
    Object.getOwnPropertyNames(obj).forEach((key) => {
        // Ignore array's length property (pretend we're not just treating it like an object)
        if (key === "length" && obj instanceof Array) {
            return;
        }

        const value = obj[key];
        const valueType = jsonType(value);

        // <details> (main container)
        const entry = document.createElement("details");
        entry.className = `entry ${valueType}`;
        entry.open = true;
        // <summary> (key and type)
        const label = document.createElement("summary");
        label.className = "key";
        // TODO: (STYLE) Pull an icon from VS Code?
        entry.appendChild(label);

        // name/key of item (inside label)
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = key;
        label.appendChild(name);

        label.innerHTML += " ";

        // type of item (inside label)
        const type = document.createElement("span");
        type.className = "type";
        type.textContent = valueType;
        label.appendChild(type);

        // value (could be another object/array)
        const valueDiv = document.createElement("div");
        valueDiv.className = "value";
        valueDiv.innerHTML = parseValue(value, valueType);

        // TODO: (FUNC) Per-entry logic here...
        // Make self editable when clicked. Super basic
        valueDiv.addEventListener("click", (event) => {
            // @ts-ignore
            event.target.contentEditable = "true";
        });

        entry.appendChild(valueDiv);

        // TODO: (FUNC) + button for collections
        // TODO: (STRETCH) Rearrange collections somehow
        //   - Keep array numbering intact

        target.appendChild(entry);
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
        case "getDataHtml":
            vscode.postMessage({
                type: "responseReady",
                requestId: message.requestId,
                body: jsonContainer.innerHTML
            });
            return;
    }
});

//@ts-ignore
document.querySelector("#ping").onclick = () => {
    vscode.postMessage({type: "ping"});
};

//#endregion

// TODO: Try out state recovery
// const state = vscode.getState();
// if (state) {}

vscode.postMessage({type: "ready"});

}());
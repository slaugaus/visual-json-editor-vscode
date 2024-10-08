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
        label.innerHTML = `<span class="name">${key}</span> <span class="type">${valueType}</span>`;
        entry.appendChild(label);
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
window.addEventListener('message', (/** @type {MessageEvent<{type: String, body: any}>} */ event) => {
    const message = event.data;
    switch (message.type) {
        case "doc":
            jsonContainer.textContent = null;
            parseObject(message.body, jsonContainer);
            // vscode.setState(something);
            break;
    }
});

//@ts-ignore
document.querySelector("#ping").onclick = () => {
    vscode.postMessage({type: "ping"});
};

//#endregion

// TODO: Test state recovery
// const state = vscode.getState();
// if (state) {}

// TODO: Saving should dump jsonContainer.innerHTML for safety?
//#region Save Logic
/**
 * "We can rebuild him, we have the technology..."
 * Turn #jsonContainer back into an object and serialize it to #jsonOutput.
 */
// function reSerialize() {
//     let resultObj = {};
//     for (const child of jsonContainer.children) {
//         addFromNode(child, resultObj);
//     }
//     const out = document.querySelector("#jsonOutput");
//     out.textContent = JSON.stringify(resultObj, null, 2); // Prettify w/ 2spc indent
// }

// Read ele.classList and return the JSON type it contains
// Theoretically the type will always be class #2, but don't make that assumption
// function getTypeOfElement(ele) {
//     const result = intersect(Array.from(ele.classList), validBaseTypes);
//     if (result.length > 1) {
//         throw new Error(
//             `Element ${ele.outerHTML} has multiple base types (${result})! It shouldn't!!`
//         );
//     }
//     return result[0];
// }

/**
 * Given child (the value as a <details> key/value pair), extract the key+value
 * and add them to parent (possibly recurring to do it fully).
 */
// function addFromNode(child, parent) {
//     const keyElement = child.querySelector(".key");
//     const valElement = child.querySelector(".value");
//     const childKey = keyElement.querySelector(".name")?.textContent;
//     let childValue;
//     switch (getTypeOfElement(child)) {
//         case "string":
//             childValue = valElement.textContent;
//             break;
//         case "number":
//             childValue = parseFloat(valElement.textContent);
//             break;
//         case "boolean":
//             childValue = valElement.textContent === "true";
//             break;
//         case "null":
//             childValue = null;
//             break;
//         case "object":
//             childValue = {};
//             for (const grandchild of valElement.children) {
//                 addFromNode(grandchild, childValue);
//             }
//             break;
//         case "array":
//             childValue = [];
//             for (const grandchild of valElement.children) {
//                 addFromNode(grandchild, childValue);
//             }
//             break;
//     }
//     // Fun fact: Arrays can be indexed by strings of ints!
//     // (It doesn't matter that parent is having its "0" set)
//     parent[childKey] = childValue;
// }
//#endregion

vscode.postMessage({type: "ready"});

}());
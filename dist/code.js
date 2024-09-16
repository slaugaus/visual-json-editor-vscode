"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const iconMap = Object.freeze({
    "string": "fa-solid fa-quote-left",
    "number": "fa-solid fa-hashtag",
    "boolean": "fa-regular fa-circle-check",
    "null": "fa-regular fa-circle-question",
    "array": "fa-solid fa-table",
    "object": "fa-solid fa-object-group"
});
// Globals
var jsonContainer = document.querySelector("#jsonContainer");
function loadJsonFile() {
    return __awaiter(this, void 0, void 0, function* () {
        const name = document.querySelector("#name");
        if (name) {
            try {
                const nameVal = name.value;
                const response = yield fetch(`./${nameVal}.json`);
                if (!response.ok) {
                    throw new Error(`Response status: ${response.status}`);
                }
                const json = yield response.json();
                vizJson(json);
            }
            catch (error) {
                console.error(error.message);
            }
        }
    });
}
function loadJsonString() {
    const name = document.querySelector("#name");
    if (name) {
        const nameVal = name.value;
        const json = JSON.parse(nameVal);
        vizJson(json);
    }
}
function clearJson() {
    jsonContainer.textContent = null;
}
/*!
 * Sanitize and encode all HTML in a user-submitted string
 * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {String} str  The user-submitted string
 * @return {String} str  The sanitized string
 */
function sanitizeHTML(str) {
    var temp = document.createElement("div");
    temp.textContent = str;
    return temp.innerHTML;
}
function parseValue(val, type) {
    if (type == null)
        type = jsonType(val);
    switch (type) {
        case "string":
            if (val === "")
                return "(empty)";
            return sanitizeHTML(val);
        case "number":
        case "boolean":
            return val;
        case "null":
            return "(null)";
        case "array":
        case "object":
            const childObj = document.createElement("div");
            parseObject(val, childObj);
            return childObj.innerHTML;
    }
}
// typeof null or Array is object. Handle that case and fall back to typeof.
function jsonType(val) {
    switch (typeof val) {
        case "object":
            if (val instanceof Array)
                return "array";
            else if (val == null)
                return "null";
        // else return "object";
        default:
            return typeof val;
    }
}
function parseObject(obj, target) {
    Object.getOwnPropertyNames(obj).forEach((key) => {
        // Ignore array's length property
        if (key === 'length' && obj instanceof Array)
            return;
        const val = obj[key];
        const valType = jsonType(val);
        const entry = document.createElement("details");
        entry.className = `entry ${valType}`;
        entry.open = true;
        const lbl = document.createElement("summary");
        lbl.className = "key";
        lbl.innerHTML = `<i class="${iconMap[valType]}"></i> ${key} <span class="type">${valType}</span>`;
        entry.appendChild(lbl);
        const valDiv = document.createElement("summary");
        valDiv.className = "value";
        valDiv.innerHTML = parseValue(val, valType);
        entry.appendChild(valDiv);
        target.appendChild(entry);
    });
}
function vizJson(obj) {
    jsonContainer.textContent = null; // nuke existing objs
    if (obj) {
        parseObject(obj, jsonContainer);
    }
}
(() => __awaiter(void 0, void 0, void 0, function* () { return yield loadJsonFile(); }))();

"use strict";

import * as Helpers from "./helpers.js";

const iconMap: Readonly<any> = Object.freeze({
  "string": "fa-solid fa-quote-left",
  "number": "fa-solid fa-hashtag",
  "boolean": "fa-regular fa-circle-check",
  "null": "fa-regular fa-circle-question",
  "array": "fa-solid fa-table",
  "object": "fa-solid fa-object-group"
})

const validBaseTypes = [
  "string",
  "number",
  "boolean",
  "null",
  "array",
  "object"
];

// Globals
var jsonContainer: HTMLDivElement = document.querySelector("#jsonContainer")!;

async function loadJsonFile(): Promise<void> {
  const name = document.querySelector("#name");
  if (name) {
    try {
      const nameVal = (name as HTMLInputElement).value;
      const response = await fetch(`./${nameVal}.json`);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const json = await response.json();

      vizJson(json);

    } catch (error: any) {
      console.error(error.message);
    }
  }
}

function loadJsonString(): void {
  const name = document.querySelector("#name");
  if (name) {
    const nameVal = (name as HTMLInputElement).value;
    const json = JSON.parse(nameVal);
    vizJson(json);
  }
}

function clearJson() {
  jsonContainer.textContent = null;
}

function parseValue(val: any, type: string) {
  if (type == null) type = jsonType(val);

  switch (type) {
    case "string":
      return Helpers.sanitizeHTML(val);
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
function jsonType(val: any): string {
  switch (typeof val) {
    case "object":
      if (val instanceof Array) return "array";
      else if (val == null) return "null";
    // else return "object";
    default:
      return typeof val;
  }
}

function parseObject(obj: any, target: HTMLDivElement) {
  Object.getOwnPropertyNames(obj).forEach((key) => {
    // Ignore array's length property
    if (key === 'length' && obj instanceof Array) return;

    const val = obj[key];
    const valType = jsonType(val);

    const entry = document.createElement("details");
    entry.className = `entry ${valType}`;
    entry.open = true;

    const label = document.createElement("summary");
    label.className = "key";
    label.innerHTML = `<i class="${iconMap[valType]}"></i> <span class="name">${key}</span> <span class="type">${valType}</span>`;
    entry.appendChild(label);

    const valDiv = document.createElement("div");
    valDiv.className = "value";
    valDiv.innerHTML = parseValue(val, valType);
    // Make self editable when clicked
    valDiv.addEventListener("click", (event) => {
      (event.target as HTMLDivElement).contentEditable = "true";
    })
    entry.appendChild(valDiv);

    target.appendChild(entry);
  });
}

function vizJson(obj: any) {
  jsonContainer.textContent = null; // nuke existing objs
  if (obj) {
    parseObject(obj, jsonContainer);
  }
}

// "We can rebuild him, we have the technology..."
// Turn #jsonContainer back into an object and serialize it to #jsonOutput.
function reSerialize(): void {
  let resultObj: Object = {};

  for (const child of jsonContainer.children) {
    addFromNode(child, resultObj);
  }

  const out = document.querySelector("#jsonOutput")!;
  out.textContent = JSON.stringify(resultObj, null, 2); // Prettify w/ 2spc indent
}

// Read ele.classList and return the JSON type it contains
// Theoretically the type will always be class #2, but don't make that assumption
function getTypeOfElement(ele: Element): string {
  const result = Helpers.intersect(Array.from(ele.classList), validBaseTypes)

  if (result.length > 1) {
    throw new Error(`Element ${ele.outerHTML} has multiple base types (${result})! It shouldn't!!`)
  }
  return result[0];
}

// Given child, the value as a <details> key/value pair Element, extract the key+value
// and add them to parent (possibly recurring to do it fully).
// TODO: what type is "string-indexable object or array?"
function addFromNode(child: Element, parent: any) {
  const keyElement = child.querySelector(".key")!;
  const valElement = child.querySelector(".value")!;

  const childKey: string = keyElement.querySelector(".name")?.textContent!;
  let childValue: any;

  switch (getTypeOfElement(child)) {
    case "string":
      childValue = valElement.textContent;
      break;
    case "number":
      childValue = parseFloat(valElement.textContent!);
      break;
    case "boolean":
      childValue = valElement.textContent === "true";
      break;
    case "null":
      childValue = null;
      break;
    case "object":
      childValue = {};
      for (const grandchild of valElement.children) {
        addFromNode(grandchild, childValue);
      }
      break;
    case "array":
      childValue = [];
      for (const grandchild of valElement.children) {
        addFromNode(grandchild, childValue);
      }
      break;
  }

  // Fun fact: Arrays can be indexed by strings of ints!
  // (It doesn't matter that parent: Array is having its "0" set)
  parent[childKey] = childValue;
}

(async () => await loadJsonFile())().then(() => reSerialize());

// Button events. Can't use onclick attribute because I'm a module...
const openBtn = document.querySelector("#open") as HTMLButtonElement;
const openStrBtn = document.querySelector("#open-str") as HTMLButtonElement;
const clearBtn = document.querySelector("#clear") as HTMLButtonElement;
const saveBtn = document.querySelector("#save") as HTMLButtonElement;

openBtn.addEventListener("click", () => loadJsonFile());

openStrBtn.addEventListener("click", () => loadJsonString());

clearBtn.addEventListener("click", () => {
  jsonContainer.innerHTML = "";
  document.querySelector("#jsonOutput")!.innerHTML = "";
});

saveBtn.addEventListener("click", () => reSerialize());

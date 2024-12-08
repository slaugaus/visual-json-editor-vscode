import { vscode } from "./vscode-webview";
import { EditAddition, Message, ObjectOrArray, OutputHTML } from "../common";
import { EditorItem } from "./EditorItem";
import { Helpers } from "./Helpers";

/** The object I was initialized with */
let startingObject = {};

// Message Handler
window.addEventListener('message', (event: MessageEvent<Message<any>>) => {
    const message = event.data;
    switch (message.type) {
        // Entrypoint for object parser (extension has a JsonDocument ready)
        case "doc":
            Helpers.jsonContainer.textContent = null;
            startingObject = message.body;
            Helpers.parseObject(message.body, Helpers.jsonContainer);
            // vscode.setState(something);
            return;

        // Extension requested a save
        case "getData":
            vscode.postMessage<OutputHTML>({
                type: "responseReady",
                requestId: message.requestId,
                body: {
                    "type": Helpers.jsonContainer.className as ObjectOrArray,
                    "html": Helpers.jsonContainer.innerHTML
                }
            });
            return;

        // Extension finished saving, clear dirty states and update the base object
        case "saved":
            Helpers.cleanChanged();
            startingObject = message.body;
            return;

        // Extension requested change to the document (Undo, redo, or revert)
        case "change":
            Helpers.jsonContainer.textContent = null;
            Helpers.parseObject(startingObject, Helpers.jsonContainer);
            Helpers.playbackEdits(message.body!.edits);
            return;

        default:
            Helpers.debugMsg(`Editor received unknown message: ${message.type}`);
            return;
    }
});

// TODO: Try out state recovery
// (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate)
// const lastState = vscode.getState();
// if (lastState) {}

document.getElementById("rootPlus")!.onclick = event => {
    const numRootItems = Helpers.jsonContainer.childElementCount;
    const newThing = EditorItem.create(
        "null",
        `New Thing ${numRootItems}`,
        null, Helpers.jsonContainer, 
        Helpers.jsonContainer.className as ObjectOrArray
    );

    Helpers.sendEdit<EditAddition>(newThing.path, "add", {
        itemType: "null",
        value: null,
        parentType: Helpers.jsonContainer.className as ObjectOrArray,
    });

    newThing.makeDirty();
    newThing.highlightAndScroll();
};

vscode.postMessage({ type: "ready" });
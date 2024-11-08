import { vscode } from "./vscode-webview";
import { EditAddition, Message, ObjectOrArray, OutputHTML } from "../common";
import { EditorItem } from "./EditorItem";
import { Helpers } from "./Helpers";

// const validBaseTypes = [
//     "string",
//     "number",
//     "boolean",
//     "null",
//     "array",
//     "object",
// ];

// Message Handler
window.addEventListener('message', (event: MessageEvent<Message<any>>) => {
    const message = event.data;
    switch (message.type) {
        case "doc":
            Helpers.jsonContainer.textContent = null;
            Helpers.parseObject(message.body, Helpers.jsonContainer);
            // vscode.setState(something);
            return;

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

        case "saved":
            Helpers.cleanChanged();
            return;

        // TODO: "change"
        case "change":
            Helpers.debugMsg("Changes (undo, redo, revert...) are not supported yet.");
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
    const newThing = new EditorItem(
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
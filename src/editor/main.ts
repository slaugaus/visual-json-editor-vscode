import { vscode } from "./vscode-webview";
import { EditAddition, JsonEdit, Message, OutputHTML } from "../common";
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
                    "type": Helpers.jsonContainer.className,
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
    const newThing = new EditorItem("string", `New Thing ${numRootItems}`, "I'm new!", Helpers.jsonContainer, Helpers.jsonContainer.className);

    Helpers.sendEdit<EditAddition>(newThing.path, "add", {
        itemType: newThing.type,
        value: newThing.value,
        parentType: Helpers.jsonContainer.className,
    });

    newThing.makeDirty();
    newThing.highlightAndScroll();
};

vscode.postMessage({ type: "ready" });
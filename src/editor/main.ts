import { vscode } from "./vscode-webview";
import { Message } from "../common";
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
            vscode.postMessage({
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

        // TODO: change

        default:
            vscode.postMessage({
                type: "debug",
                body: `Editor received unknown message: ${message.type}`
            });
            return;
    }
});

// TODO: Try out state recovery
// (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate)
// const lastState = vscode.getState();
// if (lastState) {}

let newThingId = 0;

document.getElementById("rootPlus")!.onclick = event => {
    const newThing = new EditorItem("string", `New Thing ${newThingId++}`, "I'm new!", Helpers.jsonContainer, "object");
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
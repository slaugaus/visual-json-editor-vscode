import { Message } from "../common";
import { vscode } from "./vscode-webview";
import { Helpers } from "./Helpers";

/**
 * One \<details> representing an item in a JSON object.
 */
export class EditorItem {

    constructor(
        private initType: string,
        initName: string,
        initValue: any,
        parent: HTMLElement,
        /** Whether the parent is an obj or array. Needed for renaming */
        private parentType: string
    ) {
        // Don't strictly need to pass the init values,
        // but I may want to reuse setupHtml for stuff like retyping, undo
        this.setupHtml(initType, initName, initValue, parent);

        this.setupEvents();
    }

    //#region Public Methods/Properties
    get name() {
        return this.hName.textContent;
    }

    // set name(val) {
    //     this.hName.textContent = val;
    // }
    get type() {
        return this.hType.textContent;
    }

    // set type(val) {
    //     this.hType.textContent = val;
    // }
    get value() {
        return this.hValue.innerHTML;
    }

    // set value(val) {
    //     // Don't do it this way
    //     this.hValue.innerHTML = val;
    // }
    // I wanted to cache this after the final append of setupHtml,
    // but that doesn't work for no clear reason
    get path() {
        return Helpers.getPathToItem(this.root);
    }

    readonly root: HTMLDetailsElement = document.createElement("details");

    /**
     * Turn on this item's "Dirty" (was changed) indicator(s).
     * (Turning them off is done with querySelectorAll()s in global cleanChanged()).
     */
    makeDirty() {
        this.root.classList.add("changed");
        this.hDirty.style.display = "unset";
    }

    /**
     * Scroll to me (rootDiv) smoothly, with a highlight animation (CSS-dependent)
     */
    highlightAndScroll() {
        this.root.classList.add("highlighted");

        // Detect whether I'm visible
        new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // Item is in view
                if (entry.isIntersecting) {
                    // Switch from static highlight to fade-out animation
                    this.root.classList.remove("highlighted");
                    this.root.classList.add("flash");

                    // Remove the flash class after the animation is over (1s)
                    setTimeout(() => {
                        this.root.classList.remove("flash");
                    }, 1000);

                    // Stop observing
                    observer.disconnect();
                }

                // Otherwise, scroll to it
                else {
                    this.root.scrollIntoView({ behavior: "smooth" });
                }
            });
            // Trigger when 100% visible
        }, { threshold: 1.0 }).observe(this.root);
    }

    /**
     *
     */
    addChild(type: string, name: string, value: any) {
        const newChild = new EditorItem(type, name, value, this.hValue, this.type ?? "");

        vscode.postMessage({
            type: "edit",
            body: {
                path: newChild.path,
                type: "add",
                change: newChild
            }
        });

        this.makeDirty();
        newChild.makeDirty();
        newChild.highlightAndScroll();
    }

    //#endregion
    
    //#region Private Stuff

    // The HTML comprising this item:
    private hLabel: HTMLElement = document.createElement("summary");
    private hIcon: HTMLElement = Helpers.codicon(this.initType);
    private hName: HTMLSpanElement = document.createElement("span");
    private hType: HTMLSpanElement = document.createElement("span");
    private hDirty: HTMLElement = Helpers.codicon("dirty");
    private hButtons: HTMLDivElement = document.createElement("div");
    private hValue: HTMLDivElement = document.createElement("div");

    // Type-specific items
    private hCheckbox: HTMLInputElement | undefined;
    private hAddItem: HTMLButtonElement | undefined;

    // TODO: temp items
    private hWhoAmI: HTMLButtonElement = document.createElement("button");

    /**
     * Initialize my HTML, then append to a parent element
     */
    private setupHtml(type: string, name: string, value: any, parent: HTMLElement) {
        // <details> (main container)
        this.root.className = `item ${type}`;
        this.root.open = true;

        // <summary> (key and type)
        this.hLabel.className = "key";
        this.root.append(this.hLabel);

        // <i> (Codicon inside label)
        this.hLabel.append(this.hIcon);

        // name/key of item (inside label)
        this.hName.className = "name clickable";
        this.hName.textContent = name;
        this.hLabel.append(this.hName);

        // type of item (inside label)
        this.hType.className = "type clickable";
        this.hType.textContent = type;
        this.hLabel.append(this.hType);

        // Dirty (changed) indicator that doesn't rely on color
        this.hDirty.classList.add("dirty-indicator");
        this.hDirty.style.display = "none";
        this.hLabel.append(this.hDirty);

        this.hButtons.className = "item-btns";
        this.root.append(this.hButtons);

        // value (could be another object/array)
        this.hValue.className = "value";

        // Preserve the events of child object/arrays
        if (type === "object" || type === "array") {
            this.hValue.append(...Array.from((Helpers.parseValue(value, type) as HTMLDivElement).children));
        } else {
            this.hValue.innerHTML = Helpers.parseValue(value, type) as string;
        }

        this.root.append(this.hValue);

        // Type-specific items
        if (type === "boolean") {
            this.hCheckbox = document.createElement("input");
            this.hCheckbox.type = "checkbox";
            this.hCheckbox.checked = this.value === "true";
            this.hIcon.className = Helpers.codiconMap[this.value];
            this.hValue.before(this.hCheckbox);
        }
        else if (type === "object" || type === "array") {
            this.hAddItem = document.createElement("button");
            this.hAddItem.type = "button";
            this.hAddItem.innerHTML = '<i class="codicon codicon-plus"></i>';
            this.hAddItem.className = "item-btn";
            this.hButtons.append(this.hAddItem);
        }

        // TODO: temp items
        this.hWhoAmI = document.createElement("button");
        this.hWhoAmI.type = "button";
        this.hWhoAmI.innerHTML = '<i class="codicon codicon-search"></i>';
        this.hWhoAmI.className = "item-btn";
        this.hButtons.append(this.hWhoAmI);

        parent.append(this.root);
    }

    private setupEvents() {

        this.hName.addEventListener("click", event => {
            if (this.parentType === "object") {
                event.stopPropagation();
                event.preventDefault();
                this.makeNameEditable();
            }
        });

        this.hValue.onclick = event => {
            switch (this.type) {
                case "string":
                case "number":
                    this.makeStringEditable(this.hValue);
                    break;
                case "boolean":
                    this.hCheckbox!.checked = !this.hCheckbox!.checked;
                    this.hCheckbox!.dispatchEvent(new Event("change"));
                    break;
            }
        };

        // Bool specific events
        if (this.hCheckbox) {
            this.hCheckbox.onchange = event => {
                const tf = this.hCheckbox!.checked.toString();
                this.hValue.textContent = tf;

                this.makeDirty();

                this.hIcon.className = Helpers.codiconMap[tf];

                vscode.postMessage({
                    type: "edit",
                    body: {
                        path: this.path,
                        type: "contents",
                        change: this.hValue.textContent
                    }
                });
            };

            this.hIcon.onclick = event => {
                event.stopPropagation();
                event.preventDefault();
                this.hCheckbox!.checked = !this.hCheckbox!.checked;
                this.hCheckbox!.dispatchEvent(new Event("change"));
            };
        }

        // Add button (object/array)
        else if (this.hAddItem) {
            this.hAddItem.onclick = event => {
                const count = this.hValue.childElementCount;
                const nextItem = count.toString();
                const name = this.type === "object" ? `New Item ${nextItem}` : nextItem;
                // TODO: (QOL) Intelligent type detect? (Type of most other children)
                this.addChild("string", name, "Edit me!");
            };
        }

        this.hWhoAmI.onclick = event => {
            const identity = this.path.join(".");

            const myself = Helpers.getItemFromPath(this.path);
            const itWorked = myself === this.root;

            vscode.postMessage({
                type: "debug",
                body: `You clicked on ${identity}!\n  Did getItemFromPath work? ${itWorked}`
            });
        };
    }

    /**
     * Editability for string and number
     */
    private makeStringEditable(element: HTMLElement, allowNewline: boolean = true) {
        element.hidden = true;
        element.style.display = "none";

        // TODO: May be mildly overengineered now that it's using fake-input.
        // Putting the cursor at the click position also doesn't work b/c of this
        const input = document.createElement("span");
        input.textContent = element.textContent ?? "";
        input.contentEditable = "plaintext-only";

        if (this.type === "number") {
            allowNewline = false;
            input.addEventListener("keydown", Helpers.typeNumbersOnly);
            input.addEventListener("paste", Helpers.pasteNumbersOnly);
        }

        if (allowNewline && input.textContent.includes("\n")) {
            input.className = "fake-textarea value editor string";
        } else {
            input.className = "fake-input value editor string";
            input.style.display = "initial";
        }

        element.after(input);
        input.focus();

        let wasClosed = false;

        const onClose = () => {
            if (wasClosed) { return; } // Run once
            element.hidden = false;
            element.style.display = "block";

            // TODO: Validate number
            // Did it actually change?
            if (element.textContent !== input.textContent) {
                element.textContent = input.textContent;

                this.makeDirty();

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
    private makeNameEditable() {
        this.hName.classList.add("fake-input");
        this.hName.contentEditable = "plaintext-only";
        this.hName.focus();

        const oldName = this.hName.textContent;

        let wasClosed = false;

        const onClose = () => {
            if (wasClosed) { return; }
            this.hName.classList.remove("fake-input");
            this.hName.contentEditable = "false";

            if (this.hName.textContent !== oldName) {
                this.makeDirty();

                // Strip newlines that get pasted in
                this.hName.textContent = (this.hName.textContent?.replace("\n", "") ?? null);

                vscode.postMessage({
                    type: "edit",
                    body: {
                        path: this.path,
                        type: "rename",
                        change: this.hName.textContent
                    }
                });
            }

            wasClosed = true;
        };

        this.hName.onblur = onClose;

        this.hName.onkeydown = event => {
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

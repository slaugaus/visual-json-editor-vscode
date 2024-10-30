import { EditAddition, JsonEdit, Message } from "../common";
import { vscode } from "./vscode-webview";
import { Helpers } from "./Helpers";

/**
 * One \<details> representing an item in a JSON object.
 */
export class EditorItem {

    constructor(
        private initialType: string,
        initialName: string,
        initialValue: any,
        parent: HTMLElement,
        /** Whether the parent is an obj or array. Needed for renaming */
        private parentType: "object" | "array"
    ) {
        // Don't strictly need to pass the init values,
        // but I may want to reuse setupHtml for stuff like retyping, undo
        this.setupHtml(initialType, initialName, initialValue);

        this.setupEvents(parent);

        parent.append(this.rootElement);
    }

    //#region Public Methods/Properties
    get name() {
        return this.hName.textContent ?? "unknown";
    }

    // set name(val) {
    //     this.hName.textContent = val;
    // }
    get type() {
        return this.hType.value ?? "unknown";
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
        return Helpers.getPathToItem(this.rootElement);
    }

    readonly rootElement: HTMLDetailsElement = document.createElement("details");

    /**
     * Turn on this item's "Dirty" (was changed) indicator(s).
     * (Turning them off is done with querySelectorAll()s in global cleanChanged()).
     */
    makeDirty() {
        this.rootElement.classList.add("changed");
        this.hDirty.style.display = "unset";
    }

    /**
     * Scroll to me (rootDiv) smoothly, with a highlight animation (CSS-dependent)
     */
    highlightAndScroll() {
        this.rootElement.classList.add("highlighted");

        // Detect whether I'm visible
        new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // Item is in view
                if (entry.isIntersecting) {
                    // Switch from static highlight to fade-out animation
                    this.rootElement.classList.remove("highlighted");
                    this.rootElement.classList.add("flash");

                    // Remove the flash class after the animation is over (1s)
                    setTimeout(() => {
                        this.rootElement.classList.remove("flash");
                    }, 1000);

                    // Stop observing
                    observer.disconnect();
                }

                // Otherwise, scroll to it
                else {
                    this.rootElement.scrollIntoView({ behavior: "smooth" });
                }
            });
            // Trigger when 100% visible
        }, { threshold: 1.0 }).observe(this.rootElement);
    }

    /**
     *
     */
    addChild(itemType: string, name: string, value: any) {
        const newChild = new EditorItem(itemType, name, value, this.hValue, this.type as ("object" | "array"));

        Helpers.sendEdit<EditAddition>(newChild.path, "add", {
            itemType,
            value,
            parentType: this.type as ("object" | "array"),
        });

        this.makeDirty();
        newChild.makeDirty();
        newChild.highlightAndScroll();
    }

    //#endregion

    //#region Private Stuff

    // The HTML comprising this item:
    private hLabel: HTMLElement = document.createElement("summary");
    private hIcon: HTMLElement = Helpers.codicon(this.initialType);
    private hName: HTMLSpanElement = document.createElement("span");
    private hType: HTMLSelectElement = document.createElement("select");
    private hDirty: HTMLElement = Helpers.codicon("dirty");
    private hButtons: HTMLDivElement = document.createElement("div");
    private hValue: HTMLDivElement = document.createElement("div");

    private hBtnDelete: HTMLButtonElement = document.createElement("button");
    private hBtnClear: HTMLButtonElement = document.createElement("button");

    // Type-specific items
    private hCheckbox: HTMLInputElement | undefined;
    private hAddItem: HTMLButtonElement | undefined;

    // TODO: temp items
    private hBtnWhoAmI: HTMLButtonElement = document.createElement("button");

    /**
     * Initialize my HTML. Reusable.
     */
    private setupHtml(type: string, name: string, value: any) {
        // <details> (main container)
        this.rootElement.className = `item ${type}`;
        this.rootElement.open = true;

        // <summary> (key and type)
        this.hLabel.className = "key";
        this.rootElement.append(this.hLabel);

        // <i> (Codicon inside label)
        this.hIcon.className = Helpers.codiconMap[type];
        this.hLabel.append(this.hIcon);

        // name/key of item (inside label)
        this.hName.className = "name clickable";
        this.hName.textContent = name;
        this.hLabel.append(this.hName);

        // type of item (inside label)
        this.hType.className = "type clickable";
        this.hType.innerHTML = "";
        for (const t of Helpers.validConversions[type]) {
            const option = document.createElement("option");
            option.value = t;
            option.textContent = t;
            this.hType.append(option);
        }
        if (this.hType.childElementCount <= 1) { this.hType.disabled = true; }
        this.hLabel.append(this.hType);

        // Dirty (changed) indicator that doesn't rely on color
        this.hDirty.classList.add("dirty-indicator");
        this.hDirty.style.display = "none";
        this.hLabel.append(this.hDirty);

        this.hButtons.className = "item-btns";
        for (const btn of this.hButtons.children) {
            if (btn.childElementCount > 0) { btn.innerHTML = ""; }
        }
        this.rootElement.append(this.hButtons);

        this.hBtnDelete.type = "button";
        this.hBtnDelete.title = "Delete this item"; // Tooltip
        this.hBtnDelete.append(Helpers.codicon("trash"));
        this.hBtnDelete.className = "item-btn";
        this.hButtons.append(this.hBtnDelete);

        this.hBtnClear.type = "button";
        this.hBtnClear.title = "Delete *the contents of* this item so you can change its type";
        this.hBtnClear.append(Helpers.codicon("close"));
        this.hBtnClear.className = "item-btn";
        this.hButtons.append(this.hBtnClear);

        // value (could be another object/array)
        this.hValue.className = "value";
        // Parse and place inside
        Helpers.parseValueInto(this.hValue, value, type);
        this.rootElement.append(this.hValue);

        if (this.hCheckbox) { this.hCheckbox.remove(); }
        if (this.hAddItem) { this.hAddItem.remove(); }

        // Type-specific items
        if (type === "boolean") {
            this.hCheckbox = document.createElement("input");
            this.hCheckbox.type = "checkbox";
            this.hCheckbox.checked = this.value === "true";
            this.hIcon.className = Helpers.codiconMap[this.hCheckbox.checked.toString()];
            this.hValue.before(this.hCheckbox);
        }
        else if (type === "object" || type === "array") {
            this.hAddItem = document.createElement("button");
            this.hAddItem.type = "button";
            this.hAddItem.append(Helpers.codicon("plus"));
            this.hAddItem.className = "item-btn";
            this.hButtons.append(this.hAddItem);
        }

        // TODO: temp items
        // this.hBtnWhoAmI.type = "button";
        // this.hBtnWhoAmI.append(Helpers.codicon("search"));
        // this.hBtnWhoAmI.className = "item-btn";
        // this.hButtons.append(this.hBtnWhoAmI);
    }

    private setupEvents(parent: HTMLElement) {

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

        this.hType.onchange = event => {
            // If converting to obj or array, parse an empty object instead of an empty string
            // so the "length" property doesn't appear
            let realValue: any = this.value;
            if (realValue === ""
                && (this.hType.value === "object" || this.hType.value === "array")
            ) { realValue = {}; }

            this.setupHtml(this.hType.value, this.name, realValue);
            this.setupEvents(parent);
            this.makeDirty();

            Helpers.sendEdit(this.path, "contents", this.value);
        };

        this.hBtnDelete.onclick = event => {
            Helpers.sendEdit(this.path, "delete");
            parent.dispatchEvent(new Event("make-dirty"));
            this.rootElement.remove();
        };

        this.hBtnClear.onclick = event => {
            if (this.type !== "null") {
                this.hType.disabled = false;
                this.hValue.innerHTML = "";
                this.setupHtml("null", this.name, null);
                this.setupEvents(parent);
                this.makeDirty();
                Helpers.sendEdit(this.path, "contents", this.value);
            }
        };

        this.hValue.addEventListener("make-dirty", event => this.makeDirty());

        // Bool specific events
        if (this.hCheckbox) {
            this.hCheckbox.onchange = event => {
                const tf = this.hCheckbox!.checked.toString();
                this.hValue.textContent = tf;

                this.makeDirty();

                this.hIcon.className = Helpers.codiconMap[tf];

                Helpers.sendEdit(this.path, "contents", this.hValue.textContent);
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
                this.addChild("null", name, null);
            };
        }

        this.hBtnWhoAmI.onclick = event => {
            const identity = this.path.join(".");

            const myself = Helpers.getItemFromPath(this.path);
            const itWorked = myself === this.rootElement;

            Helpers.debugMsg(`You clicked on ${identity}!\n  Did getItemFromPath work? ${itWorked}`);
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
        input.role = "textbox";

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
        // Empty spans lose their editability if there's nothing else in their parent
        input.after(document.createTextNode(" "));
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

                Helpers.sendEdit(this.path, "contents", element.textContent);
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
        this.hName.role = "textbox";
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

                Helpers.sendEdit(this.path, "rename", this.hName.textContent);
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

        // Don't fold the details
        this.hName.onkeyup = event => {
            if (event.key === " ") { event.preventDefault(); }
        };
    }
}

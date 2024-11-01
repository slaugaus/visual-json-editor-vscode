import { EditAddition, ObjectOrArray } from "../common";
// import { vscode } from "./vscode-webview";
import { Helpers } from "./Helpers";

/**
 * One \<details> representing an item in a JSON object.
 */
export class EditorItem {

    constructor(
        private readonly _initialType: string,
        initialName: string,
        initialValue: any,
        private readonly _parent: HTMLElement,
        /** Whether the parent is an obj or array. Needed for renaming */
        private readonly _parentType: ObjectOrArray
    ) {
        // Don't strictly need to pass the init values,
        // but I may want to reuse setupHtml for stuff like retyping, undo
        this._setupHtml(_initialType, initialName, initialValue);

        this._setupEvents();

        this._parent.append(this.rootElement);
    }

    //#region Public Methods/Properties
    get name() {
        return this._name.textContent ?? "unknown";
    }

    // set name(val) {
    //     this.hName.textContent = val;
    // }

    get type() {
        return this._type.value ?? "unknown";
    }

    // set type(val) {
    //     this.hType.textContent = val;
    // }

    get value() {
        return this._value.innerHTML;
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
        this._dirty.style.display = "unset";
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
     * Create a child value for me (assumes I'm a collection)
     */
    addChild(itemType: string, name: string, value: any) {
        const newChild = new EditorItem(itemType, name, value, this._value, this.type as ObjectOrArray);

        Helpers.sendEdit<EditAddition>(newChild.path, "add", {
            itemType,
            value,
            parentType: this.type as ObjectOrArray,
        });

        this.makeDirty();
        newChild.makeDirty();
        newChild.highlightAndScroll();
    }

    //#endregion

    //#region Private Stuff

    // The HTML comprising this item:
    private _label: HTMLElement = document.createElement("summary");
    private _icon: HTMLElement = Helpers.codicon(this._initialType);
    private _name: HTMLSpanElement = document.createElement("span");
    private _type: HTMLSelectElement = document.createElement("select");
    private _dirty: HTMLElement = Helpers.codicon("dirty");
    private _buttons: HTMLDivElement = document.createElement("div");
    private _value: HTMLDivElement = document.createElement("div");

    private _btnDelete: HTMLButtonElement = document.createElement("button");
    private _btnClear: HTMLButtonElement = document.createElement("button");
    private _btnMoveDown: HTMLButtonElement = document.createElement("button");
    private _btnMoveUp: HTMLButtonElement = document.createElement("button");

    // Type-specific items
    private _checkbox: HTMLInputElement | undefined;
    private _btnAddItem: HTMLButtonElement | undefined;

    // TODO: temp items
    // private hBtnWhoAmI: HTMLButtonElement = document.createElement("button");

    /**
     * Initialize my HTML. Reusable for type changer.
     */
    private _setupHtml(type: string, name: string, value: any) {
        // <details> (main container)
        this.rootElement.className = `item ${type}`;
        this.rootElement.open = true;

        // <summary> (key and type)
        this._label.className = "key";
        this.rootElement.append(this._label);

        // <i> (Codicon inside label)
        this._icon.className = Helpers.codiconMap[type];
        this._label.append(this._icon);

        // name/key of item (inside label)
        this._name.className = "name clickable";
        this._name.textContent = name;
        this._label.append(this._name);

        // type of item (inside label)
        this._type.className = "type clickable";
        this._type.innerHTML = "";
        for (const t of Helpers.validConversions[type]) {
            const option = document.createElement("option");
            option.value = t;
            option.textContent = t;
            this._type.append(option);
        }
        if (this._type.childElementCount <= 1) { this._type.disabled = true; }
        this._label.append(this._type);

        // Dirty (changed) indicator that doesn't rely on color
        this._dirty.classList.add("dirty-indicator");
        this._dirty.style.display = "none";
        this._label.append(this._dirty);

        this._buttons.className = "item-btns";
        for (const btn of this._buttons.children) {
            if (btn.childElementCount > 0) { btn.innerHTML = ""; }
        }
        this.rootElement.append(this._buttons);

        this._btnDelete.type = "button";
        this._btnDelete.title = "Delete this item"; // Tooltip
        this._btnDelete.append(Helpers.codicon("trash"));
        this._btnDelete.className = "item-btn";
        this._buttons.append(this._btnDelete);

        this._btnClear.type = "button";
        this._btnClear.title = "Delete *the contents of* this item so you can change its type";
        this._btnClear.append(Helpers.codicon("close"));
        this._btnClear.className = "item-btn";
        this._buttons.append(this._btnClear);

        this._btnMoveDown.type = "button";
        this._btnMoveDown.title = "Switch places with the item below me";
        this._btnMoveDown.append(Helpers.codicon("arrow-down"));
        this._btnMoveDown.className = "item-btn";
        this._buttons.append(this._btnMoveDown);

        this._btnMoveUp.type = "button";
        this._btnMoveUp.title = "Switch places with the item above me";
        this._btnMoveUp.append(Helpers.codicon("arrow-up"));
        this._btnMoveUp.className = "item-btn";
        this._buttons.append(this._btnMoveUp);

        // value (could be another object/array)
        this._value.className = "value";
        // Parse and place inside
        Helpers.parseValueInto(this._value, value, type);
        this.rootElement.append(this._value);

        if (this._checkbox) { this._checkbox.remove(); }
        if (this._btnAddItem) { this._btnAddItem.remove(); }

        // Type-specific items
        if (type === "boolean") {
            this._checkbox = document.createElement("input");
            this._checkbox.type = "checkbox";
            this._checkbox.checked = this.value === "true";
            this._icon.className = Helpers.codiconMap[this._checkbox.checked.toString()];
            this._value.before(this._checkbox);
        }
        else if (type === "object" || type === "array") {
            this._btnAddItem = document.createElement("button");
            this._btnAddItem.type = "button";
            this._btnAddItem.append(Helpers.codicon("plus"));
            this._btnAddItem.className = "item-btn";
            this._buttons.append(this._btnAddItem);
        }

        // TODO: temp items
        // this.hBtnWhoAmI.type = "button";
        // this.hBtnWhoAmI.append(Helpers.codicon("search"));
        // this.hBtnWhoAmI.className = "item-btn";
        // this.hButtons.append(this.hBtnWhoAmI);
    }

    /**
     * Define all of my interactivity. Reusable for type changer.
     */
    private _setupEvents() {

        // Allow other instances to call my makeDirty()
        this.rootElement.addEventListener("make-dirty", event => this.makeDirty());
        this._value.addEventListener("make-dirty", event => this.makeDirty());

        // Dispatch this after repositioning in an array to fix my index (name field).
        this.rootElement.addEventListener("renumber", event => {
            const idx = new Array(...this._parent.children).indexOf(this.rootElement);
            this._name.textContent = idx.toString();
        });

        // Name editability (except for array members)
        this._name.onclick = event => {
            if (this._parentType === "object") {
                event.stopPropagation();
                event.preventDefault();
                this._makeNameEditable();
            }
        };

        // Value editability
        this._value.onclick = event => {
            switch (this.type) {
                case "string":
                case "number":
                    this._makeStringEditable(this._value);
                    break;
                case "boolean":
                    // Toggle the checkbox and trigger its change event
                    this._checkbox!.checked = !this._checkbox!.checked;
                    this._checkbox!.dispatchEvent(new Event("change"));
                    break;
            }
        };

        // Type change logic
        this._type.onchange = event => {
            // If converting to obj or array, parse an empty object instead of an empty string
            // so the "length" property doesn't appear
            let realValue: any = this.value;
            if (realValue === ""
                && (this._type.value === "object" || this._type.value === "array")
            ) { realValue = {}; }

            this._setupHtml(this._type.value, this.name, realValue);
            this._setupEvents();
            this.makeDirty();

            Helpers.sendEdit(this.path, "contents", this.value);
        };

        this._btnDelete.onclick = event => {
            Helpers.sendEdit(this.path, "delete");
            this._parent.dispatchEvent(new Event("make-dirty"));
            this.rootElement.remove();
            if (this._parentType === "array") {
                for (const child of this._parent.children) {
                    child.dispatchEvent(new Event("renumber"));
                }
            }
        };

        this._btnClear.onclick = event => {
            if (this.type !== "null") {
                // Reset to a null object (so type can be freely changed)
                this._type.disabled = false;
                this._value.innerHTML = "";
                this._setupHtml("null", this.name, null);
                this._setupEvents();
                this.makeDirty();
                Helpers.sendEdit(this.path, "contents", this.value);
            }
        };

        this._btnMoveDown.onclick = event => {
            const next = this.rootElement.nextElementSibling;
            this._moveNextTo(next, next?.after.bind(next));
        };

        this._btnMoveUp.onclick = event => {
            const prev = this.rootElement.previousElementSibling;
            this._moveNextTo(prev, prev?.before.bind(prev));
        };

        // Bool specific events
        if (this._checkbox) {
            // On checkbox toggle
            this._checkbox.onchange = event => {
                const boxVal = this._checkbox!.checked.toString();
                this._value.textContent = boxVal;

                this.makeDirty();

                this._icon.className = Helpers.codiconMap[boxVal];

                Helpers.sendEdit(this.path, "contents", this._value.textContent);
            };

            // Icon also toggles value
            this._icon.onclick = event => {
                event.stopPropagation();
                event.preventDefault();
                this._checkbox!.checked = !this._checkbox!.checked;
                this._checkbox!.dispatchEvent(new Event("change"));
            };
        }

        // Add button (object/array only)
        else if (this._btnAddItem) {
            this._btnAddItem.onclick = event => {
                const count = this._value.childElementCount;
                const nextItem = count.toString();
                const name = this.type === "object" ? `New Item ${nextItem}` : nextItem;
                // TODO: (QOL) Intelligent type detect? (Type of most other children)
                this.addChild("null", name, null);
            };
        }

        // this.hBtnWhoAmI.onclick = event => {
        //     const identity = this.path.join(".");

        //     const myself = Helpers.getItemFromPath(this.path);
        //     const itWorked = myself === this.rootElement;

        //     Helpers.debugMsg(`You clicked on ${identity}!\n  Did getItemFromPath work? ${itWorked}`);
        // };
    }

    /**
     * Editability for string and number
     */
    private _makeStringEditable(element: HTMLElement, allowNewline: boolean = true) {
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
        // TODO: This has side effects and needs to be disposed (?)
        input.after(document.createTextNode(" "));
        input.focus();

        let wasClosed = false;

        const onClose = () => {
            if (wasClosed) { return; } // Run once - multiple events can trigger this
            element.hidden = false;
            element.style.display = "block";

            // Did it actually change?
            if (element.textContent !== input.textContent) {

                // Number validation and conversion
                if (this.type === "number") {
                    let asNumber = Number.parseFloat(input.textContent ?? "0");

                    // Whitespace (empty) can convert fine to 0
                    if (/^\s*$/.test(input.textContent ?? "")) {
                        asNumber = 0;
                    }

                    if (Number.isNaN(asNumber)) {
                        Helpers.errorMsg(`${input.textContent} couldn't be converted to a number. Canceling edit.`);
                        wasClosed = true;
                        input.remove();
                        return;
                    }

                    input.textContent = asNumber.toString();
                }

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
    /**
     * Editability for name (except for array members)
     */
    private _makeNameEditable() {
        this._name.classList.add("fake-input");
        this._name.contentEditable = "plaintext-only";
        this._name.role = "textbox";
        this._name.focus();

        const oldName = this._name.textContent;

        let wasClosed = false;

        const onClose = () => {
            if (wasClosed) { return; }
            this._name.classList.remove("fake-input");
            this._name.contentEditable = "false";

            if (this._name.textContent !== oldName) {

                if (!this._nameIsUnique(this._name.textContent)) {
                    Helpers.errorMsg(`Something else on the same layer is already named "${this._name.textContent}." Canceling edit.`);
                    this._name.textContent = oldName;
                    wasClosed = true;
                    return;
                }

                this.makeDirty();

                // Strip newlines that get pasted in
                this._name.textContent = (this._name.textContent?.replace("\n", "") ?? null);

                Helpers.sendEdit(this.path, "rename", this._name.textContent);
            }

            wasClosed = true;
        };

        this._name.onblur = onClose;

        this._name.onkeydown = event => {
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
        this._name.onkeyup = event => {
            if (event.key === " ") { event.preventDefault(); }
        };
    }

    /**
     * Swap this item with a neighbor using its "after" or "before" method.
     * @param neighbor An Element, likely acquired by next/previousElementSibling
     * @param inserter neighbor's "before" or "after" method, with .bind(neighbor) called on it to preserve context
     */
    private _moveNextTo(neighbor: Element | null, inserter: ((...nodes: (string | Node)[]) => void) | undefined) {
        if (neighbor && inserter) {
            inserter(this.rootElement);

            this.makeDirty();
            neighbor.dispatchEvent(new Event("make-dirty"));

            if (this._parentType === "array") {
                this.rootElement.dispatchEvent(new Event("renumber"));
                neighbor.dispatchEvent(new Event("renumber"));
            }

            this.highlightAndScroll();
            Helpers.sendEdit(this.path, "swap", Helpers.getPathToItem(neighbor));
        }
    }

    /**
     * Figure out if a proposed name is taken by something else on the same layer.
     * 
     * Two items within the same collection can't have the same name.
     */
    private _nameIsUnique(name: string | null): boolean {
        let count = 0;

        for (const child of this._parent.children) {
            if (Helpers.getItemName(child) === name) {
                count++;
            }
        }

        return count <= 1;  // self gets counted
    }

    //#endregion
}

import { EditAddition, ObjectOrArray, SomethingFromJson } from "../common";
// import { vscode } from "./vscode-webview";
import { Helpers } from "./Helpers";

/**
 * One \<details> representing an item in a JSON object.
 */
export class EditorItem {

    // TODO: Not needed after changing your mind about inheritance
    // This causes circular dependency problems
    static create(
        type: string,
        name: string,
        value: any,
        parent: HTMLElement,
        parentType: ObjectOrArray
    ) {
        switch (type) {
            case "string":
                return new EditorString(name, value, parent, parentType);
            case "number":
                return new EditorNumber(name, value, parent, parentType);
        }
        // else
        return new EditorItem(type, name, value, parent, parentType);
    }

    protected constructor(
        private readonly _initialType: string,
        initialName: string,
        initialValue: SomethingFromJson,
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
        return this._hName.textContent ?? "unknown";
    }

    // set name(val) {
    //     this.hName.textContent = val;
    // }

    get type() {
        return this._hType.value ?? "unknown";
    }

    // set type(val) {
    //     this.hType.textContent = val;
    // }

    get value() {
        return this._hValue.innerHTML;
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
        this._hDirty.style.display = "unset";
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
     * 
     * @todo Move to object/array subclasses
     */
    addChild(itemType: string, name: string, value: any) {
        const newChild = new EditorItem(itemType, name, value, this._hValue, this.type as ObjectOrArray);

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
    private _hLabel: HTMLElement = document.createElement("summary");
    private _hIcon: HTMLElement = Helpers.codicon(this._initialType);
    private _hName: HTMLSpanElement = document.createElement("span");
    private _hType: HTMLSelectElement = document.createElement("select");
    private _hDirty: HTMLElement = Helpers.codicon("dirty");

    protected _hButtons: HTMLDivElement = document.createElement("div");
    protected _hValue: HTMLDivElement = document.createElement("div");

    private _btnDelete: HTMLButtonElement = document.createElement("button");
    private _btnClear: HTMLButtonElement = document.createElement("button");
    private _btnMoveDown: HTMLButtonElement = document.createElement("button");
    private _btnMoveUp: HTMLButtonElement = document.createElement("button");

    // Type-specific items
    private _checkbox: HTMLInputElement | undefined;
    private _btnAddItem: HTMLButtonElement | undefined;

    // TODO: temp items
    private _btnWhoAmI: HTMLButtonElement = document.createElement("button");

    /**
     * Initialize my HTML. Reusable for type changer.
     */
    protected _setupHtml(type: string, name: string, value: any) {
        // <details> (main container)
        this.rootElement.className = `item ${type}`;
        this.rootElement.open = true;

        // <summary> (key and type)
        this._hLabel.className = "key";
        this.rootElement.append(this._hLabel);

        // <i> (Codicon inside label)
        this._hIcon.className = Helpers.codiconMap[type];
        this._hLabel.append(this._hIcon);

        // name/key of item (inside label)
        this._hName.className = "name clickable";
        this._hName.textContent = name;
        this._hLabel.append(this._hName);

        // type of item (inside label)
        this._hType.className = "type clickable";
        this._hType.innerHTML = "";
        for (const t of Helpers.validConversions[type]) {
            const option = document.createElement("option");
            option.value = t;
            option.textContent = t;
            this._hType.append(option);
        }
        if (this._hType.childElementCount <= 1) { this._hType.disabled = true; }
        this._hLabel.append(this._hType);

        // Dirty (changed) indicator that doesn't rely on color
        this._hDirty.classList.add("dirty-indicator");
        this._hDirty.style.display = "none";
        this._hLabel.append(this._hDirty);

        this._hButtons.className = "item-btns";
        for (const btn of this._hButtons.children) {
            if (btn.childElementCount > 0) { btn.innerHTML = ""; }
        }
        this.rootElement.append(this._hButtons);

        this._btnDelete.type = "button";
        this._btnDelete.title = "Delete this item"; // Tooltip
        this._btnDelete.append(Helpers.codicon("trash"));
        this._btnDelete.className = "item-btn";
        this._hButtons.append(this._btnDelete);

        this._btnClear.type = "button";
        this._btnClear.title = "Delete *the contents of* this item so you can change its type";
        this._btnClear.append(Helpers.codicon("close"));
        this._btnClear.className = "item-btn";
        this._hButtons.append(this._btnClear);

        this._btnMoveDown.type = "button";
        this._btnMoveDown.title = "Switch places with the item below me";
        this._btnMoveDown.append(Helpers.codicon("arrow-down"));
        this._btnMoveDown.className = "item-btn";
        this._hButtons.append(this._btnMoveDown);

        this._btnMoveUp.type = "button";
        this._btnMoveUp.title = "Switch places with the item above me";
        this._btnMoveUp.append(Helpers.codicon("arrow-up"));
        this._btnMoveUp.className = "item-btn";
        this._hButtons.append(this._btnMoveUp);

        // value (could be another object/array)
        this._hValue.className = "value";
        // Parse and place inside
        Helpers.parseValueInto(this._hValue, value, type);
        this.rootElement.append(this._hValue);

        if (this._checkbox) { this._checkbox.remove(); }
        if (this._btnAddItem) { this._btnAddItem.remove(); }

        // Type-specific items
        if (type === "boolean") {
            this._checkbox = document.createElement("input");
            this._checkbox.type = "checkbox";
            this._checkbox.checked = this.value === "true";
            this._hIcon.className = Helpers.codiconMap[this._checkbox.checked.toString()];
            this._hValue.before(this._checkbox);
        }
        else if (type === "object" || type === "array") {
            this._btnAddItem = document.createElement("button");
            this._btnAddItem.type = "button";
            this._btnAddItem.append(Helpers.codicon("plus"));
            this._btnAddItem.className = "item-btn";
            this._hButtons.append(this._btnAddItem);
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
    protected _setupEvents() {

        // Allow other instances to call my makeDirty()
        this.rootElement.addEventListener("make-dirty", event => this.makeDirty());
        this._hValue.addEventListener("make-dirty", event => this.makeDirty());

        // Dispatch this after repositioning in an array to fix my index (name field).
        this.rootElement.addEventListener("renumber", event => {
            const idx = new Array(...this._parent.children).indexOf(this.rootElement);
            this._hName.textContent = idx.toString();
        });

        // Name editability (except for array members)
        this._hName.onclick = event => {
            if (this._parentType === "object") {
                event.stopPropagation();
                event.preventDefault();
                this._makeNameEditable();
            }
        };

        // Value editability
        this._hValue.onclick = event => {
            switch (this.type) {
                case "boolean":
                    // Toggle the checkbox and trigger its change event
                    this._checkbox!.checked = !this._checkbox!.checked;
                    this._checkbox!.dispatchEvent(new Event("change"));
                    break;
            }
        };

        // Type change logic
        // TODO: Disabled until types are refactored
        // this._hType.onchange = event => {
        //     // If converting to obj or array, parse an empty object instead of an empty string
        //     // so the "length" property doesn't appear
        //     let realValue: any = this.value;
        //     if (realValue === ""
        //         && (this._hType.value === "object" || this._hType.value === "array")
        //     ) { realValue = {}; }

        //     this._setupHtml(this._hType.value, this.name, realValue);
        //     this._setupEvents();
        //     this.makeDirty();

        //     Helpers.sendEdit(this.path, "contents", this.value);
        // };

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
                this._hType.disabled = false;
                this._hValue.innerHTML = "";
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
                this._hValue.textContent = boxVal;

                this.makeDirty();

                this._hIcon.className = Helpers.codiconMap[boxVal];

                Helpers.sendEdit(this.path, "contents", this._hValue.textContent);
            };

            // Icon also toggles value
            this._hIcon.onclick = event => {
                event.stopPropagation();
                event.preventDefault();
                this._checkbox!.checked = !this._checkbox!.checked;
                this._checkbox!.dispatchEvent(new Event("change"));
            };
        }

        // Add button (object/array only)
        else if (this._btnAddItem) {
            this._btnAddItem.onclick = event => {
                const count = this._hValue.childElementCount;
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
     * Editability for name (except for array members)
     */
    private _makeNameEditable() {
        this._hName.classList.add("fake-input");
        this._hName.contentEditable = "plaintext-only";
        this._hName.role = "textbox";
        this._hName.focus();

        const oldName = this._hName.textContent;

        let wasClosed = false;

        const onClose = () => {
            if (wasClosed) { return; }
            this._hName.classList.remove("fake-input");
            this._hName.contentEditable = "false";
            this._hName.role = null;

            if (this._hName.textContent !== oldName) {

                if (!this._nameIsUnique(this._hName.textContent)) {
                    Helpers.errorMsg(`Something else on the same layer is already named "${this._hName.textContent}." Canceling edit.`);
                    this._hName.textContent = oldName;
                    wasClosed = true;
                    return;
                }

                this.makeDirty();

                // Strip newlines that get pasted in
                this._hName.textContent = (this._hName.textContent?.replace("\n", "") ?? null);

                Helpers.sendEdit(this.path, "rename", this._hName.textContent);
            }

            wasClosed = true;
        };

        this._hName.onblur = onClose;

        this._hName.onkeydown = event => {
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
        this._hName.onkeyup = event => {
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


// TODO: You changed your mind. These should be separate classes that message(?) EditorItem.
// TODO: These should be in separate files, but there's a circular dependency issue

interface EditorValue {
    /** 
     * Pass in an EditorItem's _hValue.
     * Dispatching custom events onto me allows for messaging the EditorItem if necessary.
     */
    rootElement: HTMLDivElement;
    
    /**
     * If defined, this element's textContent is the value to be used for serialization
     * instead of rootElement's.
     */
    realValue?: HTMLElement;

    setupMyHtml(): void;
    setupMyEvents(): void;
}

class EditorString extends EditorItem {

    constructor(
        initialName: string,
        initialValue: any,
        parent: HTMLElement,
        /** Whether the parent is an obj or array. Needed for renaming */
        parentType: ObjectOrArray
    ) {
        super("string", initialName, initialValue, parent, parentType);

        // this._setupMyHtml(initialName, initialValue);

        this._setupMyEvents();
    }

    // private _setupMyHtml(name: string, value: any) {
    // No additional elements
    // }

    private _setupMyEvents() {
        // Editability
        // Reassigning onclick overrides base (which eventually shouldn't have one)
        this._hValue.onclick = () => {
            const oldValue = this._hValue.textContent;

            if (oldValue?.includes("\n")) {
                this._hValue.classList.add("fake-textarea");
            } else {
                this._hValue.classList.add("fake-input");
            }

            this._hValue.contentEditable = "plaintext-only";
            this._hValue.role = "textbox";  // A11y feature?

            let wasClosed = false;

            this._hValue.focus();

            const onClose = () => {
                if (wasClosed) { return; }
                this._hValue.classList.remove("fake-input", "fake-textarea");
                this._hValue.contentEditable = "false";
                this._hValue.role = null;

                if (this._hValue.textContent !== oldValue) {
                    this.makeDirty();
                    Helpers.sendEdit(this.path, "contents", this._hValue.textContent);
                }

                wasClosed = true;
            };

            this._hValue.onblur = onClose;

            this._hValue.onkeydown = event => {
                switch (event.key) {
                    case "Escape":
                        onClose();
                        break;
                    case "Enter":
                        if (this._hValue.classList.contains("fake-input")) {
                            this._hValue.classList.remove("fake-input");
                            // this._hValue.style.display = "block";
                            this._hValue.classList.add("fake-textarea");
                        }
                        break;
                }
            };
        };
    };
}

class EditorNumber extends EditorItem {

    constructor(
        initialName: string,
        initialValue: any,
        parent: HTMLElement,
        parentType: ObjectOrArray
    ) {
        super("number", initialName, initialValue, parent, parentType);

        this._setupMyEvents();
    }

    private _setupMyEvents() {
        // Editability
        // Reassigning onclick overrides base (which eventually shouldn't have one)
        this._hValue.onclick = () => {
            const oldValue = this._hValue.textContent;
            this._hValue.classList.add("fake-input");
            this._hValue.contentEditable = "plaintext-only";
            this._hValue.role = "textbox";  // A11y feature?

            this._hValue.addEventListener("keydown", Helpers.typeNumbersOnly);
            this._hValue.addEventListener("paste", Helpers.pasteNumbersOnly);

            let wasClosed = false;

            this._hValue.focus();

            const onClose = () => {
                if (wasClosed) { return; }
                this._hValue.classList.remove("fake-input");
                this._hValue.contentEditable = "false";
                this._hValue.role = null;

                // Nothing happened - done
                if (this._hValue.textContent === oldValue) {
                    wasClosed = true;
                    return;
                }

                // Number validation and conversion
                // (Done immediately so editor never contains invalid JSON)
                let asNumber = Number.parseFloat(this._hValue.textContent ?? "0");

                // While parseFloat returns NaN, we can assume empty/whitespace to be 0
                if (/^\s*$/.test(this._hValue.textContent ?? "")) {
                    asNumber = 0;
                }

                // parseFloat failed
                if (Number.isNaN(asNumber)) {
                    Helpers.errorMsg(`${this._hValue.textContent} couldn't be converted to a number. Canceling edit.`);
                    wasClosed = true;
                    this._hValue.remove();
                    return;
                }

                this._hValue.textContent = asNumber.toString();

                this.makeDirty();
                Helpers.sendEdit(this.path, "contents", this._hValue.textContent);

                wasClosed = true;
            };

            this._hValue.onblur = onClose;

            this._hValue.onkeydown = event => {
                switch (event.key) {
                    case "Escape":
                        onClose();
                        break;
                    case "Enter":
                        event.preventDefault();
                        event.stopPropagation();
                        onClose();
                        break;
                }
            };
        };
    };
}
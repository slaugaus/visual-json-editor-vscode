import { EditAddition, JsonEditType, ObjectOrArray, SomethingFromJson } from "../common";
// import { vscode } from "./vscode-webview";
import { Helpers } from "./Helpers";
import { EditorValue } from "./EditorValue";

/**
 * One \<details> representing an item in a JSON object.
 */
export class EditorItem {

    static create(
        type: string,
        name: string,
        value: SomethingFromJson,
        parent: HTMLElement,
        /** Whether the parent is an obj or array. Needed for renaming */
        parentType: ObjectOrArray
    ): EditorItem {
        return new EditorItem(type, name, value, parent, parentType);
    }

    private constructor(
        private readonly _initialType: string,
        initialName: string,
        initialValue: SomethingFromJson,
        private readonly _parent: HTMLElement,
        private readonly _parentType: ObjectOrArray
    ) {
        this._setupHtml(_initialType, initialName);

        this._setupEvents();

        this._setupValue(_initialType, initialValue);

        this._parent.append(this.rootElement);

        // Edge case - Autogen name from add buttons could rarely cause a collision
        if (!this._nameIsUnique(initialName)){
            // Not really a proper fix, only makes it rarer
            this._hName.textContent += " (1)";
        }
    }

    //#region Public Methods/Properties
    get name() {
        return this._hName.textContent ?? "unknown";
    }

    get type(): string {
        return this._hType.value ?? "unknown";
    }

    get value() {
        const maybeValue: string | undefined = this._value?.realValue?.innerHTML
            ?? this._value?.rootElement.innerHTML;
        return maybeValue ?? "";
    }

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

    //#endregion

    //#region Private Stuff

    private _value?: EditorValue;

    // The HTML comprising this item:
    private _hLabel: HTMLElement = document.createElement("summary");
    private _hIcon: HTMLElement = Helpers.codicon(this._initialType);
    private _hName: HTMLSpanElement = document.createElement("span");
    private _hType: HTMLSelectElement = document.createElement("select");
    private _hDirty: HTMLElement = Helpers.codicon("dirty");

    private _hButtons: HTMLDivElement = document.createElement("div");
    private _hValue: HTMLDivElement = document.createElement("div");

    private _btnDelete: HTMLButtonElement = document.createElement("button");
    private _btnClear: HTMLButtonElement = document.createElement("button");
    private _btnMoveDown: HTMLButtonElement = document.createElement("button");
    private _btnMoveUp: HTMLButtonElement = document.createElement("button");

    // Type-specific button(s)
    private _btnAddItem: HTMLButtonElement | undefined;

    // TODO: temp items
    // private _btnWhoAmI: HTMLButtonElement = document.createElement("button");

    //#region Initializers

    /**
     * Initialize my HTML. Reusable for type changer.
     */
    private _setupHtml(type: string, name: string) {
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

        // Type-specific button(s)
        if (this._btnAddItem) { this._btnAddItem.remove(); }

        if (type === "object" || type === "array") {
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
    private _setupEvents() {

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

        // Type change logic
        this._hType.onchange = event => {
            // If converting to obj or array, parse an empty object instead of an empty string
            // so the "length" property doesn't appear
            let realValue: unknown = this.value;
            if ((realValue === "" || realValue === undefined)
                && (this._hType.value === "object" || this._hType.value === "array")
            ) { realValue = {}; }

            this._setupHtml(this.type, this.name);
            this._setupEvents();
            this._setupValue(this.type, realValue);
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
                this._hType.disabled = false;
                this._hValue.innerHTML = "";
                this._setupHtml("null", this.name);
                this._setupEvents();
                this._setupValue("null", null);
                this.makeDirty();
                Helpers.sendEdit(this.path, "contents", null);
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

        // For bools, let the icon act as a checkbox
        if (this.type === "boolean") {
            // Icon also toggles value
            this._hIcon.onclick = event => {
                event.stopPropagation();
                event.preventDefault();
                this._hValue.dispatchEvent(new Event("external-toggle"));
            };

            // Icon matches checkbox state
            this._hValue.addEventListener("change-icon", event => {
                const detail = (event as CustomEvent<string>).detail;
                this._hIcon.className = Helpers.codiconMap[detail];
            });
        }

        // Add button (object/array only)
        if (this._btnAddItem) {
            this._btnAddItem.onclick = event => {
                const count = this._hValue.childElementCount;
                const nextItem = count.toString();
                const name = this.type === "object" ? `New Item ${nextItem}` : nextItem;
                // TODO: (QOL) Intelligent type detect? (Type of most other children)
                this._value!.addChild!("null", name, null);
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
     * Initialize the value div
     */
    private _setupValue(type: string, value: SomethingFromJson | unknown) {
        this._hValue.innerHTML = "";
        this._hValue.className = "value-container";

        // Null value gets an empty div
        if (type !== "null") {
            this._value = EditorValue.create(type, value, this._hValue,
                // Use a delegate to let value class make edits without knowing path
                (type: JsonEditType, change?: any) => {
                    Helpers.sendEdit(this.path, type, change);
                }
            );
        }

        this.rootElement.append(this._hValue);
    }

    //#endregion

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
                    Helpers.errorMsg(`Something else on the same layer is already named "${this._hName.textContent}". Canceling edit.`);
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

    //#endregion
}
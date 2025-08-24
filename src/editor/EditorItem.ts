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
        if (!this._nameIsUnique(initialName)) {
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
    }

    /**
     * Scroll to me (rootDiv) smoothly, with a highlight animation (CSS-dependent)
     */
    highlightAndScroll() {
        if (Helpers.ignoreEdits) { return; }
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
    private _hLabel = document.createElement("summary");
    private _hIcon: HTMLElement = Helpers.codicon(this._initialType);
    private _hName = document.createElement("span");
    private _hType = document.createElement("select");

    private _hButtons = document.createElement("ul");
    private _hValue = document.createElement("div");

    private _btnDelete = document.createElement("li");
    private _btnClear = document.createElement("li");
    private _btnMoveDown = document.createElement("li");
    private _btnMoveUp = document.createElement("li");

    // Type-specific button(s)
    private _btnAddItem: HTMLLIElement | undefined;

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
        if (this._parentType !== "array") { this._hName.classList.add("editable-text"); }
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

        this._hButtons.className = "item-btns";
        for (const btn of this._hButtons.children) {
            if (btn.childElementCount > 0) { btn.innerHTML = ""; }
        }
        this._hLabel.append(this._hButtons);

        this._btnDelete.title = "Delete this item"; // Tooltip
        this._btnDelete.append(Helpers.codicon("trash", "a"));
        this._btnDelete.className = "item-btn delete-btn";
        this._hButtons.append(this._btnDelete);

        this._btnClear.title = "Delete *the contents of* this item so you can change its type";
        this._btnClear.append(Helpers.codicon("clear-all", "a"));
        this._btnClear.className = "item-btn clear-btn";
        this._hButtons.append(this._btnClear);

        this._btnMoveDown.title = "Switch places with the item below me";
        this._btnMoveDown.append(Helpers.codicon("arrow-down", "a"));
        this._btnMoveDown.className = "item-btn down-btn";
        this._hButtons.append(this._btnMoveDown);

        this._btnMoveUp.title = "Switch places with the item above me";
        this._btnMoveUp.append(Helpers.codicon("arrow-up", "a"));
        this._btnMoveUp.className = "item-btn up-btn";
        this._hButtons.append(this._btnMoveUp);

        // Type-specific button(s)
        if (this._btnAddItem) { this._btnAddItem.remove(); }

        if (type === "object" || type === "array") {
            this._btnAddItem = document.createElement("li");
            this._btnAddItem.title = `Add an item to the ${type}`;
            this._btnAddItem.append(Helpers.codicon("plus", "a"));
            this._btnAddItem.className = "item-btn add-btn";
            this._hButtons.append(this._btnAddItem);
        }
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

            Helpers.sendEdit(this.path, "type", this.type);
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
                Helpers.sendEdit(this.path, "type", "null");
            }
        };

        this._btnMoveDown.onclick = event => {
            const next = this.rootElement.nextElementSibling;
            if (this._moveNextTo(next, next?.after.bind(next))) {
                Helpers.sendEdit(this.path, "move", "down");
            }
        };

        this._btnMoveUp.onclick = event => {
            const prev = this.rootElement.previousElementSibling;
            if (this._moveNextTo(prev, prev?.before.bind(prev))) {
                Helpers.sendEdit(this.path, "move", "up");
            }
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

        // Set a CSS var that array children can reference to show their parent's name
        this._hValue.style.setProperty("--array-parent-name", `'${this.name}['`);

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
        const oldPath = this.path;

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
                // Update name for children of arrays
                this._hValue.style.setProperty("--array-parent-name", `'${this.name}['`);

                Helpers.sendEdit(oldPath, "rename", this._hName.textContent);
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
     * @param inserter neighbor's "before" or "after" method, with .bind(neighbor)
     *     called on it to preserve context
     * @todo Preserve the item's position on screen, like Colab
     */
    private _moveNextTo(
        neighbor: Element | null, 
        inserter: ((...nodes: (string | Node)[]) => void) | undefined
    ): boolean {
        if (neighbor && inserter) {
            inserter(this.rootElement);

            this.makeDirty();
            neighbor.dispatchEvent(new Event("make-dirty"));

            if (this._parentType === "array") {
                this.rootElement.dispatchEvent(new Event("renumber"));
                neighbor.dispatchEvent(new Event("renumber"));
            }

            this.highlightAndScroll();
            return true;
            // sendEdit is done by a method with more information
        }
        return false;
    }

    //#endregion
}
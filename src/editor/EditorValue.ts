import { Helpers } from "./Helpers";
import { EditAddition, JsonEditType, ObjectOrArray, SomethingFromJson } from "../common";
import { EditorItem } from "./EditorItem";
import { isLosslessNumber, LosslessNumber } from "lossless-json";

export abstract class EditorValue {
    static create(
        type: string,
        value: SomethingFromJson | unknown,
        target: HTMLDivElement,
        delegate: PartialEditDelegate
    ): EditorValue | undefined {
        switch (type) {
            case "string":
                return new EditorString(value as string, target, delegate);
            case "number":
                return new EditorNumber(value as number | LosslessNumber, target, delegate);
            case "boolean":
                return new EditorBool(value as boolean, target, delegate);
            case "object":
            case "array":
                return new EditorCollection(type as ObjectOrArray, value as object | any[], target, delegate);
            case "color":
                return new EditorColor(value as string, target, delegate);
            case "datetime":
                return new EditorDateTime(value as string | number, target, delegate);
        }
    }
}

export interface EditorValue {
    /** 
     * Pass in an EditorItem's _hValue.
     * Dispatching custom events onto me allows for messaging the EditorItem if necessary.
     */
    // For style reasons, don't reset its class by assigning to className.
    readonly rootElement: HTMLDivElement;

    /**
     * If defined, this element's textContent is the value to be used for serialization
     * instead of rootElement's.
     */
    readonly realValue?: HTMLElement;

    /**
     * If defined, this value is a collection of EditorItems and can have more added
     */
    addChild?(itemType: string, name: string, value: any): void;
}

/**
 * The two value-dependent parameters of Helpers.sendEdit. EditorValues shouldn't
 * be concerned about the path to their parent EditorItem.
 */
export type PartialEditDelegate = <T = any>(type: JsonEditType, change?: T) => void;

class EditorString implements EditorValue {

    constructor(
        initialValue: string,
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    private _setupHtml(value: string) {
        this.rootElement.textContent = value;
        this.rootElement.classList.add("value");
        this.rootElement.classList.add("editable-text");
    }

    private _setupEvents() {
        // Editability
        this.rootElement.onclick = () => {
            const oldValue = this.rootElement.textContent;

            if (oldValue?.includes("\n")) {
                this.rootElement.classList.add("fake-textarea");
            } else {
                this.rootElement.classList.add("fake-input");
            }

            this.rootElement.contentEditable = "plaintext-only";
            this.rootElement.role = "textbox";  // A11y feature?

            let wasClosed = false;

            this.rootElement.focus();

            const onClose = () => {
                if (wasClosed) { return; }
                this.rootElement.classList.remove("fake-input", "fake-textarea");
                this.rootElement.contentEditable = "false";
                this.rootElement.role = null;

                if (this.rootElement.textContent !== oldValue) {
                    this.rootElement.dispatchEvent(new Event("make-dirty"));
                    this._sendEdit("contents", this.rootElement.textContent);
                }

                wasClosed = true;
            };

            this.rootElement.onblur = onClose;

            this.rootElement.onkeydown = event => {
                switch (event.key) {
                    case "Escape":
                        onClose();
                        break;
                    case "Enter":
                        if (this.rootElement.classList.contains("fake-input")) {
                            this.rootElement.classList.remove("fake-input");
                            this.rootElement.classList.add("fake-textarea");
                        }
                        break;
                }
            };
        };
    };
}

class EditorNumber implements EditorValue {

    constructor(
        initialValue: number | LosslessNumber,
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    private _setupHtml(value: number | LosslessNumber) {
        if (isLosslessNumber(value)) {
            this.rootElement.textContent = value.value;
        } else {
            this.rootElement.textContent = value.toString();
        }
        this.rootElement.classList.add("value");
        this.rootElement.classList.add("editable-text");
    }

    private _setupEvents() {
        // Editability
        this.rootElement.onclick = () => {
            const oldValue = this.rootElement.textContent;
            this.rootElement.classList.add("fake-input");
            this.rootElement.contentEditable = "plaintext-only";
            this.rootElement.role = "textbox";  // A11y feature?

            this.rootElement.addEventListener("keydown", EditorNumber.typeNumbersOnly);

            let wasClosed = false;

            this.rootElement.focus();

            const onClose = () => {
                if (wasClosed) { return; }
                this.rootElement.classList.remove("fake-input");
                this.rootElement.contentEditable = "false";
                this.rootElement.role = null;

                // Nothing happened - done
                if (this.rootElement.textContent === oldValue) {
                    wasClosed = true;
                    return;
                }

                // Number validation and conversion
                // (Done immediately so editor never contains invalid JSON)

                // Empty/whitespace and extra 0s can fall back to 0
                if (/^[\s0]*$/.test(this.rootElement.textContent ?? "")) {
                    this.rootElement.textContent = "0";
                } else {
                    try {
                        // Use LosslessNumber's validation
                        this.rootElement.textContent = new LosslessNumber(this.rootElement.textContent ?? "0").toString();
                    } catch (e) {
                        Helpers.errorMsg(`${this.rootElement.textContent} is not a number. Canceling edit.`);
                        wasClosed = true;
                        this.rootElement.textContent = oldValue;
                        return;
                    }
                }

                this.rootElement.dispatchEvent(new Event("make-dirty"));
                this._sendEdit("contents", this.rootElement.textContent);

                wasClosed = true;
            };

            this.rootElement.onblur = onClose;

            this.rootElement.addEventListener("keydown", event => {
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
            });
        };
    };

    /** 
     * For keydown events, block anything that's not a number.
     * 
     * (Because I want to use the fancy fake inputs)
     */
    static typeNumbersOnly(event: KeyboardEvent) {
        // Navigation keys allowed
        if (event.key === "Backspace"
            || event.key === "Delete"
            || event.key === "Tab"
            || event.key === "Escape"
            || event.key === "ArrowLeft"
            || event.key === "ArrowRight"
            || event.key === "Home"
            || event.key === "End"
        ) { return; }

        // Block everything else but numbers, e (exponent), signs, and decimal point
        if (!/^[0-9]|e|E|-|\+|\.$/.test(event.key)) {
            event.preventDefault();
        }
    }
}

class EditorBool implements EditorValue {

    constructor(
        initialValue: boolean | "",
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        // Type change can pass ""
        if (initialValue === "") { initialValue = false; }
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    // HTML parser used in the backend can't handle checkboxes
    // & dumping HTML doesn't preserve checkbox state anyway
    readonly realValue: HTMLSpanElement = document.createElement("span");

    private _checkbox: HTMLInputElement = document.createElement("input");
    // Being inside a label makes realValue toggle the checkbox on click
    private _label: HTMLLabelElement = document.createElement("label");
    // For customizing a checkbox in styles
    private _fakeCheckbox: HTMLSpanElement = document.createElement("span");

    /**
     * \<label class="bool-label">
     *     \<input type="checkbox"/>
     *     \<span class="fake-checkbox">\</span>
     *     \<span class="value">true\</span>
     * \</label>
     */
    private _setupHtml(value: boolean) {
        this._checkbox.type = "checkbox";
        this._checkbox.checked = value;
        this._label.append(this._checkbox);

        this._fakeCheckbox.role = "checkbox";
        this._fakeCheckbox.ariaChecked = value.toString();
        this._fakeCheckbox.className = "fake-checkbox";
        this._label.append(this._fakeCheckbox);

        this.realValue.textContent = value.toString();
        this.realValue.className = "value";
        this._label.append(this.realValue);

        this._label.className = "bool-label";
        this.rootElement.append(this._label);

        this.rootElement.dispatchEvent(new CustomEvent("change-icon", {
            detail: value.toString()
        }));
    }

    private _setupEvents() {
        this._checkbox.onchange = event => {
            const boxVal = this._checkbox.checked.toString();
            this.realValue.textContent = boxVal;

            this._sendEdit("contents", boxVal);

            this.rootElement.dispatchEvent(new Event("make-dirty"));

            this.rootElement.dispatchEvent(new CustomEvent("change-icon", {
                detail: boxVal
            }));
        };

        // Allow the parent (clickable icon) to toggle me
        this.rootElement.addEventListener("external-toggle", event => {
            this._checkbox.checked = !this._checkbox.checked;
            this._checkbox.dispatchEvent(new Event("change"));
        });
    }
}

/**
 * Class for both objects and arrays. The one meaningful difference between them
 * (named vs. indexed children) is handled in EditorItem.
 */
class EditorCollection implements EditorValue {

    constructor(
        private _type: ObjectOrArray,
        initialValue: any,
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
    }

    addChild(itemType: string, name: string, value: any) {
        const newChild = EditorItem.create(itemType, name, value, this.rootElement, this._type);

        this._sendEdit<EditAddition>("add", {
            itemType,
            value,
            parentType: this._type,
        });
        // TODO: Name of this object needs to be in the path!

        this.rootElement.dispatchEvent(new Event("make-dirty"));
        newChild.makeDirty();
        newChild.highlightAndScroll();
    }

    private _setupHtml(initialValue: any) {
        Helpers.parseObject(initialValue, this.rootElement);
        this.rootElement.classList.add("value");
    }
}

/**
 * GUIDE TO TYPE ADDITION
 * (see tags are Ctrl+clickable)
 * - common.ts: Add to editorSubTypes
 * - @see {@link Helpers}:
 *      - Put a Codicon in @see {@link Helpers.codiconMap}
 *      - Add to @see {@link Helpers.validConversions}
 *      - Detect your type in @see {@link Helpers.detectType}
 *        or @see {@link Helpers.detectSpecialString}
 * 
 * - Implement a new type class here; @see {@link EditorBool} is a good reference
 * - Add your type class to @see {@link EditorValue.create}
 * - If you get yelled at on save, fix JsonDocument._addFromNode
 */


class EditorColor implements EditorValue {

    constructor(
        initialValue: string,
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        // Type change can pass ""
        if (initialValue === "") { initialValue = "#000000"; }
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    readonly realValue: HTMLSpanElement = document.createElement("span");

    private _picker: HTMLInputElement = document.createElement("input");

    private _label: HTMLLabelElement = document.createElement("label");

    /**
     * \<label>
     *     \<input type="color" value="$value"/>
     *     \<span class="value">$value\</span>
     * \</label>
     */
    private _setupHtml(value: string) {
        this._picker.type = "color";
        this._picker.value = value;

        this._label.append(this._picker);

        this.realValue.textContent = value;
        this.realValue.className = "value";
        this._label.append(this.realValue);

        this.rootElement.append(this._label);
    }

    private _setupEvents() {
        this._picker.onchange = event => {
            const newColor = this._picker.value;
            this.realValue.textContent = newColor;

            this._sendEdit("contents", newColor);

            this.rootElement.dispatchEvent(new Event("make-dirty"));

            this.rootElement.parentElement!.style.borderColor = newColor;
        };
    }
}

class EditorDateTime implements EditorValue {

    constructor(
        initialValue: string | number,
        readonly rootElement: HTMLDivElement,
        private readonly _sendEdit: PartialEditDelegate
    ) {
        // Type change can pass ""
        if (initialValue === "") { initialValue = Date.now(); }
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    readonly realValue: HTMLSpanElement = document.createElement("span");

    // input type=datetime-local
    private _picker: HTMLInputElement = document.createElement("input");

    private _label: HTMLLabelElement = document.createElement("label");

    private _setupHtml(value: string | number) {
        this._picker.type = "datetime-local";
        this._picker.step = "0.001";  // adds second and millisecond fields

        const iso = new Date(value).toISOString();
        // annoyingly, datetime-local doesn't accept the trailing Z
        this._picker.value = iso.slice(0, 23);

        this._label.append(this._picker);

        this.realValue.textContent = iso;
        this.realValue.className = "value";
        this._label.append(this.realValue);

        this.rootElement.append(this._label);
    }

    private _setupEvents() {
        this._picker.onchange = event => {
            const iso = this._picker.value + "Z";

            this.realValue.textContent = iso;

            this._sendEdit("contents", iso);
            this.rootElement.dispatchEvent(new Event("make-dirty"));
        };
    }
}
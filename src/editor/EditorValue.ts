import { Helpers } from "./Helpers";
import { JsonEditType, SomethingFromJson } from "../common";

export abstract class EditorValue {
    static create(
        type: string,
        value: SomethingFromJson,
        target: HTMLDivElement,
        delegate: PartialEditDelegate
    ): EditorValue | undefined {
        switch (type) {
            case "string":
                return new EditorString(value as string, target, delegate);
            case "number":
                return new EditorNumber(value as number, target, delegate);
            case "boolean":
                return new EditorBool(value as boolean, target, delegate);
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
}

/**
 * The two value-dependent parameters of Helpers.sendEdit. EditorValues shouldn't
 * be concerned about the path to their parent EditorItem.
 */
export type PartialEditDelegate = (type: JsonEditType, change?: any) => void;

class EditorString implements EditorValue {

    constructor(
        initialValue: string,
        readonly rootElement: HTMLDivElement,
        readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    private _setupHtml(value: string) {
        this.rootElement.textContent = value;
        this.rootElement.classList.add("value");
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
        initialValue: number,
        readonly rootElement: HTMLDivElement,
        readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    private _setupHtml(value: number) {
        this.rootElement.textContent = value.toString();
        this.rootElement.classList.add("value");
    }

    private _setupEvents() {
        // Editability
        // Reassigning onclick overrides base (which eventually shouldn't have one)
        this.rootElement.onclick = () => {
            const oldValue = this.rootElement.textContent;
            this.rootElement.classList.add("fake-input");
            this.rootElement.contentEditable = "plaintext-only";
            this.rootElement.role = "textbox";  // A11y feature?

            this.rootElement.addEventListener("keydown", Helpers.typeNumbersOnly);
            this.rootElement.addEventListener("paste", Helpers.pasteNumbersOnly);

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
                let asNumber = Number.parseFloat(this.rootElement.textContent ?? "0");

                // While parseFloat returns NaN, we can assume empty/whitespace to be 0
                if (/^\s*$/.test(this.rootElement.textContent ?? "")) {
                    asNumber = 0;
                }

                // parseFloat failed
                if (Number.isNaN(asNumber)) {
                    Helpers.errorMsg(`${this.rootElement.textContent} couldn't be converted to a number. Canceling edit.`);
                    wasClosed = true;
                    this.rootElement.remove();
                    return;
                }

                this.rootElement.textContent = asNumber.toString();

                this.rootElement.dispatchEvent(new Event("make-dirty"));
                this._sendEdit("contents", this.rootElement.textContent);

                wasClosed = true;
            };

            this.rootElement.onblur = onClose;

            this.rootElement.onkeydown = event => {
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

class EditorBool implements EditorValue {

    constructor(
        initialValue: boolean,
        readonly rootElement: HTMLDivElement,
        readonly _sendEdit: PartialEditDelegate
    ) {
        this._setupHtml(initialValue);
        this._setupEvents();
    }

    // HTML parser used in the backend can't handle checkboxes
    // & dumping HTML doesn't preserve checkbox state anyway
    readonly realValue: HTMLSpanElement = document.createElement("span");

    private _checkbox: HTMLInputElement = document.createElement("input");
    // Being inside a label makes realValue toggle the checkbox on click
    private _label: HTMLLabelElement = document.createElement("label");

    /**
     * \<label>
     *     \<input type="checkbox"/>
     *     \<span class="value">true\</span>
     * \</label>
     */
    private _setupHtml(value: boolean) {
        this._checkbox.type = "checkbox";
        this._checkbox.checked = value;

        this._label.append(this._checkbox);

        this.realValue.textContent = value.toString();
        this.realValue.className = "value";
        this._label.append(this.realValue);

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
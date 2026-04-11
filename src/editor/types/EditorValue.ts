export type EditorValue = {
	/**
	 * Pass in an EditorItem's _hValue. Dispatching custom events onto me allows for
	 * messaging the EditorItem if necessary.
	 */
	// For style reasons, don't reset its class by assigning to className.
	readonly rootElement: HTMLDivElement;

	/**
	 * If defined, this element's textContent is the value to be used for serialization
	 * instead of rootElement's.
	 */
	readonly realValue?: HTMLElement;

	/** If defined, this value is a collection of EditorItems and can have more added. */
	addChild?(itemType: string, name: string, value: any): void;
};

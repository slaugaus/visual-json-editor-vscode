import codiconMap from './codiconMap';

/**
 * Creates a Codicon element from the map or the string directly.
 *
 * @param name A key of {@link codiconMap}.
 * @param elementType An HTML element name compatible with document.createElement() - in
 *   case <i> isn't good enough
 * @returns \<i class="key">\</i>
 */
export default function codicon(name: string, elementType = 'i'): HTMLElement {
	const icon = document.createElement(elementType);
	icon.className = codiconMap.get(name) ?? `codicon codicon-${name}`;

	return icon;
}

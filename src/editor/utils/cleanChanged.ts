/** Removes the dirty indicator from everything that has one. */
export default function cleanChanged() {
	document
		.querySelectorAll('.item.changed')
		.forEach(item => item.classList.remove('changed'));
}

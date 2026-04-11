// TODO: customize - https://v2.tauri.app/learn/window-menu/
import { Menu } from '@tauri-apps/api/menu';

const menu = await Menu.new({
	items: [
		{
			id: 'quit',
			text: 'Quit',
			action: () => {
				console.log('quit pressed');
			},
		},
		{
			id: 'check_item',
			text: 'Check Item',
			checked: true,
		},
		{
			item: 'Separator',
		},
		{
			id: 'disabled_item',
			text: 'Disabled Item',
			enabled: false,
		},
		{
			id: 'status',
			text: 'Status: Processing...',
		},
	],
});

// If a window was not created with an explicit menu or had one set explicitly,
// this menu will be assigned to it.
const result = await menu.setAsAppMenu();
if (result) {
	console.log('menu set success', result);

	// Update individual menu item text
	const statusItem = await menu.get('status');
	if (statusItem) {
		await statusItem.setText('Status: Ready');
	}
}

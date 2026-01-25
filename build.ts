import { build } from 'bun';
import console from 'console';
import process from 'process';
import { copyFileSync } from 'fs';

const production = process.argv.includes('--production');

async function buildExtension() {
	await build({
		entrypoints: ['./src/extension/extension.ts'],
		format: 'cjs',
		target: 'node',
		minify: production,
		sourcemap: production ? 'none' : 'inline',
		external: ['vscode'],
		outdir: './dist',
	});
}

async function buildEditor() {
	await build({
		entrypoints: ['./src/editor/editor.ts'],
		format: 'iife',
		target: 'browser',
		minify: production,
		sourcemap: production ? 'none' : 'inline',
		external: ['vscode'],
		outdir: './dist',
	});
	copyFileSync('./node_modules/@vscode/codicons/dist/codicon.css', './dist/codicon.css');
	copyFileSync('./node_modules/@vscode/codicons/dist/codicon.ttf', './dist/codicon.ttf');
}

async function main() {
	console.time('build finished');
	await buildExtension();
	await buildEditor();
	console.timeEnd('build finished');
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
#!/usr/bin/env bun

import console from 'node:console';
import { copyFileSync } from 'node:fs';
import process from 'node:process';
import { build } from 'bun';
import { SolidPlugin } from 'bun-plugin-solid';

const production = process.argv.includes('--production');
const standalone = process.argv.includes('--standalone');

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
		plugins: [SolidPlugin()],
		entrypoints: standalone
			? ['./src/editor/vscode-webview-shim.ts', './src/editor/editor.ts']
			: ['./src/editor/editor.ts'],
		format: 'iife',
		target: 'browser',
		minify: production,
		sourcemap: production ? 'none' : 'inline',
		external: standalone ? undefined : ['vscode'],
		outdir: './dist',
	});
	copyFileSync('./node_modules/@vscode/codicons/dist/codicon.css', './dist/codicon.css');
	copyFileSync('./node_modules/@vscode/codicons/dist/codicon.ttf', './dist/codicon.ttf');
}

async function main() {
	console.time('build finished');
	if (!standalone) {
		await buildExtension();
	}
	await buildEditor();
	console.timeEnd('build finished');
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});

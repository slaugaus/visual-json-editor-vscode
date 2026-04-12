#!/usr/bin/env bun

import console from 'node:console';
import { copyFileSync } from 'node:fs';
import process from 'node:process';

import { build } from 'bun';
import { SolidPlugin } from 'bun-plugin-solid';

const production = process.argv.includes('--production');
const standalone = process.argv.includes('--standalone');

const buildExtension = async () => {
	await build({
		plugins: [SolidPlugin({ generate: 'ssr', hydratable: false })],
		entrypoints: ['./src/extension/extension.ts'],
		format: 'cjs',
		target: 'node',
		minify: production,
		sourcemap: production ? 'none' : 'inline',
		external: ['vscode'],
		outdir: './dist',
	});
};

const buildEditor = async () => {
	await build({
		plugins: [SolidPlugin()],
		entrypoints: standalone
			? ['./src/standalone/index.html']
			: ['./src/editor/editor.ts'],
		format: 'iife',
		target: 'browser',
		minify: production,
		sourcemap: production ? 'none' : 'inline',
		external: standalone ? undefined : ['vscode'],
		outdir: standalone ? './dist-standalone' : './dist',
	});
};

try {
	console.time('build finished');
	if (!standalone) {
		await buildExtension();
		copyFileSync(
			'./node_modules/@vscode/codicons/dist/codicon.css',
			'./dist/codicon.css',
		);
		copyFileSync(
			'./node_modules/@vscode/codicons/dist/codicon.ttf',
			'./dist/codicon.ttf',
		);
	}
	await buildEditor();
	console.timeEnd('build finished');
} catch (error) {
	console.error(error);
	process.exit(1);
}

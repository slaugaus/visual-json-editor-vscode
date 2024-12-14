const esbuild = require("esbuild");
const { copy } = require("esbuild-plugin-copy");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function buildExtension() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension/main.ts',
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

async function buildEditor() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/editor/main.ts',
		],
		bundle: true,
		format: 'iife',	// Immediately-Invoked Function Expression - limits scope
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/editor.js',
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
			copy({
				resolveFrom: "cwd",
				assets: {
					from: [
						"./node_modules/@vscode/codicons/dist/codicon.css",
						"./node_modules/@vscode/codicons/dist/codicon.ttf"
					],
					to: ["./dist"]
				}
			})
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

async function main() {
	await buildExtension();
	await buildEditor();
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});

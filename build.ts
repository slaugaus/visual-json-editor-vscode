import * as Bun from 'bun';
import console from 'console';
import process from 'process';

const production = process.argv.includes('--production');

async function buildExtension() {
    await Bun.build({
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
    await Bun.build({
        entrypoints: ['./src/editor/editor.tsx'],
        format: 'iife',
        target: 'browser',
        minify: production,
        sourcemap: production ? 'none' : 'inline',
        external: ['vscode'],
        outdir: './dist',
    });
}

async function main() {
    await buildExtension();
    await buildEditor();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

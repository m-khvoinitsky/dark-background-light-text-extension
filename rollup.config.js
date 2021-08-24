import typescript from '@rollup/plugin-typescript';
import node_resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import clear from 'rollup-plugin-clear';
import { terser } from 'rollup-plugin-terser';

import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import autoPreprocess from 'svelte-preprocess';

export default (args) => {
    let output_opts = {};
    const common_plugins = [
        typescript({
            sourceMap: args.watch === true,
            exclude: [
                // this folder is handled by Svelte preprocessor
                "src/preferences/**",
            ],
        }),
        node_resolve(),
        commonjs(),
    ];
    if (args.watch === true) {
        output_opts = {
            plugins: [],
            format: 'iife',
            sourcemap: true,
        };
    } else {
        output_opts = {
            plugins: [terser()],
            format: 'iife',
            sourcemap: false,
        };
    }
    return [
        {
            input: 'src/content/index.ts',
            plugins: [
                clear({
                    targets: ['dist'],
                }),
                copy({
                    targets: [
                        { src: 'manifest.json', dest: 'dist/' },
                        { src: 'icons/*', dest: 'dist/icons/' },
                        { src: 'ui/*', dest: 'dist/ui/' },
                    ],
                }),
                ...common_plugins,
            ],
            output: {
                file: 'dist/content.js',
                ...output_opts,
            },
        },
        {
            input: 'src/background/index.ts',
            plugins: [...common_plugins],
            output: {
                file: 'dist/background.js',
                ...output_opts,
            },
        },
        {
            input: 'src/preferences/main.ts',
            plugins: [
                svelte({
                    preprocess: autoPreprocess({ sourceMap: true }),
                    compilerOptions: {
                        // enable run-time checks when not in production
                        dev: args.watch === true,
                    },
                }),
                css({ output: 'preferences.css' }),
                ...common_plugins,
            ],
            output: {
                file: 'dist/preferences.js',
                name: 'app',
                ...output_opts,
            },
        },
        {
            input: 'src/browser-action/index.ts',
            plugins: [...common_plugins],
            output: {
                file: 'dist/browser-action.js',
                ...output_opts,
            },
        },
    ];
};

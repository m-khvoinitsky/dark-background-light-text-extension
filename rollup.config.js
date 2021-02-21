import typescript from '@rollup/plugin-typescript';
import node_resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import clear from 'rollup-plugin-clear';
import { terser } from 'rollup-plugin-terser';

export default (args) => {
    let output_opts = {};
    const common_plugins = [
        typescript(),
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
            input: 'src/preferences/index.ts',
            plugins: [...common_plugins],
            output: {
                file: 'dist/preferences.js',
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

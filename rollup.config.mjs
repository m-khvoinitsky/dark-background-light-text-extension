import typescript from '@rollup/plugin-typescript';
import node_resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { cp, mkdir } from 'node:fs/promises';
import clear from 'rollup-plugin-clear';
import terser from '@rollup/plugin-terser';

import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import autoPreprocess from 'svelte-preprocess';

function onwarn(warning, warn) {
  // svelte's runtime is built out of deliberate cycles; there is nothing to
  // fix on our side, and letting them through would defeat --failAfterWarnings
  if (
    warning.code === 'CIRCULAR_DEPENDENCY'
    && (warning.ids ?? []).every((id) => id.includes('node_modules'))
  ) {
    return;
  }
  warn(warning);
}

function copy_static(dest_dir) {
  return {
    name: 'copy-static',
    async writeBundle() {
      await mkdir(dest_dir, { recursive: true });
      await cp('manifest.json', `${dest_dir}/manifest.json`);
      await cp('icons', `${dest_dir}/icons`, { recursive: true });
      await cp('ui', `${dest_dir}/ui`, { recursive: true });
    },
  };
}

export default (args) => {
  let output_opts;
  const common_plugins = [
    typescript({
      sourceMap: args.watch === true,
    }),
    // without the browser condition svelte's exports map resolves to its
    // server build, whose mount() throws lifecycle_function_unavailable
    node_resolve({
      browser: true,
      exportConditions: ['browser'],
    }),
    commonjs(),
  ];
  const dest_dir = process.env.ADDON_DIST_DIR ?? 'dist';
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
          targets: [dest_dir],
        }),
        copy_static(dest_dir),
        ...common_plugins,
      ],
      output: {
        file: `${dest_dir}/content.js`,
        ...output_opts,
      },
      onwarn,
    },
    {
      input: 'src/background/index.ts',
      plugins: [...common_plugins],
      output: {
        file: `${dest_dir}/background.js`,
        ...output_opts,
      },
      onwarn,
    },
    {
      // both UI pages in one build so rollup can hoist the svelte runtime
      // they share into a single chunk instead of emitting it twice
      input: {
        preferences: 'src/preferences/main.ts',
        'browser-action': 'src/browser-action/main.ts',
      },
      plugins: [
        svelte({
          preprocess: autoPreprocess({ sourceMap: true }),
          compilerOptions: {
            // enable run-time checks when not in production
            dev: args.watch === true,
          },
        }),
        css({ output: 'ui.css' }),
        ...common_plugins,
      ],
      output: {
        dir: dest_dir,
        // code splitting needs a module format; extension pages load these
        // with <script type="module">, unlike the content script
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'shared-[hash].js',
        plugins: output_opts.plugins,
        sourcemap: output_opts.sourcemap,
      },
      onwarn,
    },
  ];
};

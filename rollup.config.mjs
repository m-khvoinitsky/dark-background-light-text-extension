import typescript from '@rollup/plugin-typescript';
import node_resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { cp, mkdir } from 'node:fs/promises';
import clear from 'rollup-plugin-clear';
import terser from '@rollup/plugin-terser';

import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import autoPreprocess from 'svelte-preprocess';

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
    node_resolve(),
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
    },
    {
      input: 'src/background/index.ts',
      plugins: [...common_plugins],
      output: {
        file: `${dest_dir}/background.js`,
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
        file: `${dest_dir}/preferences.js`,
        name: 'app',
        ...output_opts,
      },
    },
    {
      input: 'src/browser-action/index.ts',
      plugins: [...common_plugins],
      output: {
        file: `${dest_dir}/browser-action.js`,
        ...output_opts,
      },
    },
  ];
};

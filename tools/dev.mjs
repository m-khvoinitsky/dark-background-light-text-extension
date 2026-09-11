#!/usr/bin/env node
/**
 * Development loop: rollup watches the sources and writes build-dev/, web-ext
 * watches build-dev/ and reloads the add-on.
 *
 * Everything on the command line is handed to `web-ext run` untouched, so any
 * of its options work without a script per target:
 *
 *   npm run dev -- --target=firefox-android --android-device=NAME
 *   npm run dev -- --firefox=deved --devtools
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'rollup';
import { load_config } from './bundle.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dest_dir = path.join(root, 'build-dev');

// index.js sits at the package root, so this lands on the real bin script.
// Spawning it through node keeps this working on Windows, where the
// node_modules/.bin entry is a shell shim rather than a symlink.
const web_ext = fileURLToPath(
  new URL('./bin/web-ext.js', import.meta.resolve('web-ext')),
);

const watcher = watch(await load_config(dest_dir, { dev: true }));

let started = false;
watcher.on('event', (event) => {
  switch (event.code) {
    case 'BUNDLE_END':
      // rollup's own docs: not closing here leaks the bundle's resources
      event.result?.close();
      break;
    case 'ERROR':
      console.error(event.error);
      break;
    case 'END':
      // END arrives once every config in the array has finished, which is the
      // point at which build-dev/ is complete enough for web-ext to load
      if (!started) {
        started = true;
        start_web_ext();
      }
      break;
    default:
      break;
  }
});

function start_web_ext() {
  const args = ['run', '--source-dir', dest_dir, ...process.argv.slice(2)];
  const child = spawn(process.execPath, [web_ext, ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  child.on('exit', async (code) => {
    await watcher.close();
    process.exit(code ?? 0);
  });
}

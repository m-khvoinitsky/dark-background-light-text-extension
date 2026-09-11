#!/usr/bin/env node
/**
 * Release build: work out what the sources hash to, bundle into a directory
 * named after that, pack it, and check the result with addons-linter.
 *
 * The directory and archive names carry the build's identity, so two builds of
 * the same source land in the same place and a build made from a dirty tree
 * says so in its own name.
 */
import { createInstance as create_linter } from 'addons-linter';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';
import { source_id } from './source-id.mjs';
import { create_zip } from './zip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// Where the build directory and the .xpi are written. The pre-commit gate runs
// the real build for its checks but points this at a temporary directory, so
// committing does not leave artifacts behind.
const out_root = process.env.ADDON_BUILD_OUT ?? root;

async function collect_files(dir, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(dir, relative), {
    withFileTypes: true,
  })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collect_files(dir, child)));
    } else {
      files.push({ name: child, data: await readFile(path.join(dir, child)) });
    }
  }
  return files;
}

/** addons-linter reads the archive with a real zip parser, so this is also what
 *  proves tools/zip.mjs produced something a browser will accept. */
async function lint(xpi) {
  const linter = create_linter({
    config: {
      _: [xpi],
      logLevel: 'fatal',
      stack: false,
      pretty: false,
      privileged: false,
      warningsAsErrors: false,
      metadata: false,
      output: 'none',
      boring: true,
      selfHosted: false,
      enterprise: false,
      minManifestVersion: 2,
      maxManifestVersion: 3,
      enableDataCollectionPermissions: true,
    },
    runAsBinary: false,
  });
  const results = await linter.run();
  for (const warning of results.warnings) {
    console.warn(`  warning  ${warning.code}  ${warning.file ?? ''}`);
  }
  for (const error of results.errors) {
    console.error(`  error    ${error.code}  ${error.file ?? ''}`);
  }
  if (results.summary.errors > 0) {
    throw new Error(
      `addons-linter reported ${results.summary.errors} error(s)`,
    );
  }
  return results.summary;
}

const id = source_id(root);
const dest_dir = path.join(out_root, `build-release-${id}`);
const xpi = path.join(out_root, `build-release-${id}.xpi`);

console.log(`building ${path.basename(dest_dir)}`);
await rm(dest_dir, { recursive: true, force: true });
await bundle(dest_dir);

const files = await collect_files(dest_dir);
await writeFile(xpi, await create_zip(files));

const summary = await lint(xpi);
console.log(
  `${path.basename(xpi)}: ${files.length} files,`
    + ` ${summary.warnings} warning(s), no errors`,
);

import { strict as assert } from 'assert';
import { describe, it, before, after } from 'mocha';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error: plain .mjs helpers, deliberately untyped
import { create_zip } from '../tools/zip.mjs';
// @ts-expect-error: plain .mjs helpers, deliberately untyped
import { list_files_walk } from '../tools/source-id.mjs';
// @ts-expect-error: plain .mjs helpers, deliberately untyped
import { amo_manifest_json } from '../tools/manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('create_zip', () => {
  const files = [
    { name: 'b.txt', data: Buffer.from('second') },
    { name: 'a/nested.txt', data: Buffer.from('first') },
    { name: 'compressible.txt', data: Buffer.alloc(4096, 0x61) },
  ];

  it('is byte-for-byte reproducible', async () => {
    // the whole reason for not shelling out to `zip`, which records mtimes
    assert.deepEqual(await create_zip(files), await create_zip(files));
  });

  it('does not depend on the order it is given entries', async () => {
    assert.deepEqual(
      await create_zip(files),
      await create_zip([...files].reverse()),
    );
  });

  it('does not depend on the local timezone', async () => {
    // JSZip converts the entry date to a DOS timestamp; if it ever did that
    // with local rather than UTC components, two machines would disagree
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Tokyo';
      const tokyo = await create_zip(files);
      process.env.TZ = 'America/Los_Angeles';
      assert.deepEqual(tokyo, await create_zip(files));
    } finally {
      process.env.TZ = previous;
    }
  });

  it('rejects duplicate names', async () => {
    const duplicated = [
      { name: 'a.txt', data: Buffer.from('one') },
      { name: 'a.txt', data: Buffer.from('two') },
    ];
    await assert.rejects(() => create_zip(duplicated), /duplicate entry name/);
  });
});

describe('amo_manifest_json', () => {
  // Mirrors python's json.dumps(value, indent=2), which is what AMO stores.
  // Verified byte-for-byte against python3 by hand; these guard the two
  // properties that differ from every other formatter in the repo.
  it('writes no trailing newline', () => {
    assert.ok(!amo_manifest_json('{"a": 1}').endsWith('\n'));
  });

  it('puts every array element on its own line', () => {
    assert.equal(
      amo_manifest_json('{"a": ["one", "two"]}'),
      '{\n  "a": [\n    "one",\n    "two"\n  ]\n}',
    );
  });

  it('leaves empty collections inline, as python does', () => {
    assert.equal(
      amo_manifest_json('{"a": [], "b": {}}'),
      '{\n  "a": [],\n  "b": {}\n}',
    );
  });

  it('preserves key order rather than sorting', () => {
    assert.equal(
      amo_manifest_json('{"b": 1, "a": 2}'),
      '{\n  "b": 1,\n  "a": 2\n}',
    );
  });
});

describe('list_files_walk', () => {
  // The walk exists for builds made from a source archive, where there is no
  // git to ask. It has to produce exactly the list git would have given, or the
  // same sources would build under two different ids.
  //
  // Comparing against `git ls-files` in the working tree would be unfair: that
  // honours the developer's personal ignore file and .git/info/exclude, neither
  // of which exists in an archive. So the comparison is made against a pristine
  // export of HEAD, which is what a reviewer actually downloads.
  let exported: string | undefined;

  before(() => {
    if (!existsSync(path.join(root, '.git'))) {
      return; // no git here; nothing to compare against
    }
    exported = mkdtempSync(path.join(tmpdir(), 'dblt-export-'));
    const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD'], {
      cwd: root,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    execFileSync('tar', ['-x', '-C', exported], { input: tar });
  });

  after(() => {
    if (exported) {
      rmSync(exported, { recursive: true, force: true });
    }
  });

  it('matches what git tracks, over a pristine export of HEAD', function () {
    if (!exported) {
      this.skip();
    }
    const tracked = execFileSync(
      'git',
      ['ls-tree', '--full-tree', '--name-only', '-r', '-z', 'HEAD'],
      { cwd: root, encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean)
      .sort();

    assert.deepEqual(list_files_walk(exported), tracked);
  });
});

/**
 * Identity for a build: which files went into it, hashed.
 *
 * The file list is "everything git would not ignore". Inside a clone that is
 * `git ls-files`; from a source archive downloaded off GitHub there is no
 * `.git`, so the same set is derived by walking the tree and applying
 * `.gitignore` directly. Both paths must agree, or the same source would build
 * under two different names — see test/source-id.mts, which checks exactly that
 * whenever git is available.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function has_git(root) {
  // a worktree or submodule has .git as a file rather than a directory
  return existsSync(path.join(root, '.git'));
}

/** Tracked files plus untracked ones that are not ignored. */
export function list_files_git(root) {
  // -z has no long form; without it a newline in a filename would split a row
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  return git(root, args).split('\0').filter(Boolean).sort();
}

/** The same set, derived without git. */
export function list_files_walk(root) {
  const matcher = ignore();
  const gitignore = path.join(root, '.gitignore');
  if (existsSync(gitignore)) {
    matcher.add(readFileSync(gitignore, 'utf8'));
  }

  const files = [];
  const walk = (relative) => {
    const entries = readdirSync(path.join(root, relative || '.'), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      // git never lists .git and no rule excludes it, so the two listings can
      // only agree if it is skipped here as well
      if (entry.name === '.git') {
        continue;
      }
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // testing the directory before descending is what reproduces git's
        // rule that a file cannot be re-included below an excluded directory
        if (!matcher.ignores(`${child}/`)) {
          walk(child);
        }
      } else if (!matcher.ignores(child)) {
        // symlinks land here too, which matches git recording them as blobs
        files.push(child);
      }
    }
  };
  walk('');
  return files.sort();
}

export function list_source_files(root) {
  return has_git(root) ? list_files_git(root) : list_files_walk(root);
}

/** Content hash over the listed files. Paths and lengths are hashed alongside
 *  the bytes so that moving content between files changes the result. */
export function hash_files(root, files) {
  const hash = createHash('sha256');
  for (const file of files) {
    const content = readFileSync(path.join(root, file));
    hash.update(`${file}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest('hex');
}

/**
 * A build identity of the form `<label>[-dirty]-<hash>`.
 *
 * The hash is computed identically with or without git, so a clone and the
 * source archive of the same commit produce the same one. The label is only a
 * convenience for reading directory listings, and the dirty marker exists so
 * that a build made from an unclean tree cannot be mistaken for a release.
 */
export function source_id(root) {
  const files = list_source_files(root);
  const hash = hash_files(root, files).slice(0, 12);

  let label;
  let dirty = false;
  if (has_git(root)) {
    try {
      // --tags so a lightweight tag counts too; without it describe sees only
      // annotated ones and silently falls back to a bare commit hash
      const describe = ['describe', '--tags', '--always', '--abbrev=12'];
      label = git(root, describe).trim();
      // --porcelain reports untracked files too, which `describe --dirty` does not
      dirty = git(root, ['status', '--porcelain']).trim().length > 0;
    } catch {
      label = undefined; // a repository with no commits yet
    }
  }
  if (!label) {
    // prefixed with v to match what `git describe` returns on a tag, so that a
    // build from a release's source archive and a build from a clone of that
    // tag come out with the same name rather than merely the same hash
    const manifest = path.join(root, 'manifest.json');
    label = `v${JSON.parse(readFileSync(manifest, 'utf8')).version}`;
  }

  return `${label}${dirty ? '-dirty' : ''}-${hash}`;
}

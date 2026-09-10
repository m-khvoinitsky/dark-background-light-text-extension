/**
 * Deterministic .xpi packing.
 *
 * JSZip does the format; all this adds is the handful of choices that make two
 * runs over identical content produce identical bytes, which the `zip` utility
 * cannot do because it records each file's mtime:
 *
 *   - entries sorted by name, so the order never depends on directory iteration
 *   - one fixed timestamp rather than the files' own
 *   - no directory entries, which would otherwise carry timestamps too
 *
 * JSZip arrives as a dependency of web-ext and is declared directly so that
 * this does not quietly depend on web-ext's dependency tree. Verified
 * reproducible across timezones; test/test-build-tools.mts keeps it that way.
 */
import JSZip from 'jszip';

// any constant would do; this is the earliest a DOS timestamp can express
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1));

/**
 * @param {Array<{ name: string, data: Buffer }>} files
 * @returns {Promise<Buffer>} the complete archive
 */
export async function create_zip(files) {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].name === sorted[i - 1].name) {
      throw new Error(`duplicate entry name: ${sorted[i].name}`);
    }
  }

  const zip = new JSZip();
  for (const { name, data } of sorted) {
    zip.file(name, data, { date: FIXED_DATE, createFolders: false });
  }
  // awaited rather than returned directly so the duplicate-name check above
  // still surfaces as a rejection rather than a synchronous throw
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

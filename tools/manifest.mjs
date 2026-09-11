/**
 * manifest.json, serialised the way AMO stores it.
 *
 * AMO normalises every upload in repack_fileupload (addons-server,
 * src/olympia/files/tasks.py), behind an `enable-manifest-normalization` waffle
 * switch:
 *
 *     manifest.write_text(json.dumps(json_data, indent=2))
 *
 * Python's json.dumps with indent=2 puts every array element on its own line and
 * writes no trailing newline. JSON.stringify(value, null, 2) agrees with it byte
 * for byte on this manifest — checked against python3 — and would only diverge
 * on non-ASCII text, which Python escapes to \\uXXXX and JavaScript does not, or
 * on floats, which Python writes as 1.0 where JavaScript writes 1. The manifest
 * has neither; if a translated description ever introduces non-ASCII, this needs
 * revisiting.
 *
 * Applying this when packing rather than committing it keeps the file in the
 * repository readable and under the ordinary formatting rules, while the shipped
 * copy still compares equal to the signed .xpi.
 */
export function amo_manifest_json(source_text) {
  return JSON.stringify(JSON.parse(source_text), null, 2);
}

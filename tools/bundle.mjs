/**
 * One rollup pass into a chosen directory. Shared by tools/build.mjs, which
 * wants a one-shot release bundle, and tools/dev.mjs, which wants the watch
 * events; neither runs this file directly.
 *
 * Uses rollup's JS API rather than its CLI. `--failAfterWarnings` has no API
 * equivalent, so the warning count is kept here instead.
 */
import { rollup } from 'rollup';

/** Rollup reads the destination from the environment, and the config function
 *  looks at it on every call, so this must be set before load_config runs. */
export async function load_config(dest_dir, { dev = false } = {}) {
  process.env.ADDON_DIST_DIR = dest_dir;
  const { default: config } = await import('../rollup.config.mjs');
  return config({ configDev: dev });
}

/** Wraps the config's own onwarn so warnings are still printed, but counted. */
function counting_onwarn(config, counter) {
  return (warning) =>
    config.onwarn(warning, (kept) => {
      counter.count++;
      console.warn(kept.message ?? kept);
    });
}

export async function bundle(dest_dir, { dev = false } = {}) {
  const configs = await load_config(dest_dir, { dev });
  const counter = { count: 0 };
  for (const config of configs) {
    const built = await rollup({
      ...config,
      onwarn: counting_onwarn(config, counter),
    });
    try {
      await built.write(config.output);
    } finally {
      await built.close();
    }
  }
  if (counter.count > 0) {
    throw new Error(`rollup emitted ${counter.count} warning(s)`);
  }
}

// @ts-ignore: suppress '(!) Plugin typescript: @rollup/plugin-typescript TS2307: Cannot find module './App.svelte' or its corresponding type declarations.' error for non-svelte bundles compilation
import App from './App.svelte';
import type { Browser } from 'webextension-polyfill';
declare const browser: Browser;

const app = new App({
  target: document.body,
  props: {
    browser: browser,
  },
});

export default app;

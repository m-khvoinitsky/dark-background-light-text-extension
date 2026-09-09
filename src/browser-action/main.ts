import { mount } from 'svelte';
// @ts-ignore: suppress '(!) Plugin typescript: @rollup/plugin-typescript TS2307: Cannot find module './Action.svelte' or its corresponding type declarations.' error for non-svelte bundles compilation
import Action from './Action.svelte';
import type { Browser } from 'webextension-polyfill';
declare const browser: Browser;

const app = mount(Action, {
  target: document.body,
  props: {
    browser: browser,
  },
});

export default app;

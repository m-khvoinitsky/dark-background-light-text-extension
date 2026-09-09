<script lang="ts">
  import type { Browser, Tabs } from 'webextension-polyfill';
  import {
    get_merged_configured_common,
    get_prefs,
    set_pref,
    send_message,
  } from '../common/shared';
  import { DEFAULT_ID, methods } from '../methods/methods';
  import { hint_marker } from '../common/generate-urls';
  import { smart_generate_urls } from '../common/smart-generate-urls';
  import type { MethodIndex } from '../common/types';
  import { MessageAction } from '../common/types';
  import '../common/ui-style';

  export let browser: Browser;

  const CURRENT_TAB_LABEL = '< Current Tab >';

  interface UrlPart {
    /** shown in the drop-down */
    label: string;
    /** key this configuration is stored under; undefined means the current tab */
    url?: string;
    /** the entry generate_urls hinted at as the most sensible default */
    preferred: boolean;
    configuration: MethodIndex;
  }

  let enabled = false;
  let is_private = false;
  let shown_urls: UrlPart[] = [];
  let current_urlpart: UrlPart | undefined;

  const current_tab_promise: Promise<Tabs.Tab> = (async () => {
    const tabs = await browser.tabs.query({
      // popup in the new Fenix is now in a separate window
      currentWindow:
        (await browser.runtime.getPlatformInfo()).os === 'android'
          ? undefined
          : true,
      active: true,
    });
    return tabs[0];
  })();

  // state the frame around the settings needs, which must resolve even when
  // this page turns out not to be modifiable
  const base_ready: Promise<void> = (async () => {
    const [prefs_enabled, tab, platform] = await Promise.all([
      get_prefs('enabled'),
      current_tab_promise,
      browser.runtime.getPlatformInfo(),
    ]);
    enabled = prefs_enabled;
    is_private = tab.incognito;
    if (platform.os === 'android') {
      document.body.classList.add('touchscreen');
    }
  })();

  const ready: Promise<void> = (async () => {
    const tab = await current_tab_promise;
    try {
      await browser.tabs.executeScript(tab.id, {
        code: '{}',
        runAt: 'document_start',
      });
    } catch (e) {
      throw new Error(
        `Modification of this page is not available due to ${
          (await browser.runtime.getBrowserInfo()).name
        } restrictions`,
        { cause: e },
      );
    }
    if (tab.url!.indexOf(browser.runtime.getURL('/')) === 0) {
      throw new Error(
        "Extension's own internal pages are already well configured",
      );
    }

    // both are needed before the list can be built, so wait for them together
    // rather than letting the list render against a half-loaded configuration
    const [merged_configured, tab_configuration] = await Promise.all([
      get_merged_configured_common(() =>
        send_message({ action: MessageAction.GET_CONFIGURED_PRIVATE }),
      ),
      send_message({
        action: MessageAction.GET_TAB_CONFIGURATION,
        tab_id: tab.id!,
      }),
    ]);

    const parts: UrlPart[] = [];
    let next_is_preferred = false;
    for (const url of smart_generate_urls(tab.url!, true)) {
      if (url === hint_marker) {
        next_is_preferred = true;
        continue;
      }
      parts.push({
        label: url,
        url,
        preferred: next_is_preferred,
        configuration: merged_configured[url] ?? DEFAULT_ID,
      });
      next_is_preferred = false;
    }
    // pick while still narrowest-first, so the most specific configured entry
    // wins, falling back to the one generate_urls hinted at
    const preselected =
      parts.find((part) => part.configuration !== DEFAULT_ID)
      ?? parts.find((part) => part.preferred)
      ?? parts[0];

    // the drop-down lists broadest first and narrowest last
    parts.reverse();
    parts.push({
      label: CURRENT_TAB_LABEL,
      preferred: false,
      configuration:
        tab_configuration === false ? DEFAULT_ID : tab_configuration,
    });
    shown_urls = parts;

    current_urlpart =
      tab_configuration === false ? preselected : parts[parts.length - 1];
  })();

  async function close() {
    window.close(); // works for pop-up on desktop
    const tab = await current_tab_promise;
    if (!tab.active) {
      // this is the case for Fennec where pop-up is actually a tab
      // activating any tab other than our fake pop-up will close pop-up
      browser.tabs.update(tab.id, { active: true });
    }
  }

  async function save_current_urlpart() {
    const part = current_urlpart!;
    const value = part.configuration === DEFAULT_ID ? null : part.configuration;
    if (part.url === undefined) {
      await send_message({
        action: MessageAction.SET_CONFIGURED_TAB,
        key: (await current_tab_promise).id!,
        value,
      });
    } else if (is_private) {
      await send_message({
        action: MessageAction.SET_CONFIGURED_PRIVATE,
        key: part.url,
        value,
      });
    } else {
      const configured_pages = await get_prefs('configured_pages');
      if (value === null) {
        delete configured_pages[part.url];
      } else {
        configured_pages[part.url] = value;
      }
      await set_pref('configured_pages', configured_pages);
    }
    await close();
  }

  function on_method_change() {
    save_current_urlpart().catch((rejection) => console.error(rejection));
  }

  function on_enabled_change() {
    set_pref('enabled', enabled)
      .then(() => close())
      .catch((rejection) => console.error(rejection));
  }
</script>

<main class="container-fluid">
  {#await base_ready}
    Loading...
  {:then}
    <label class="enabled_label"
      >Enabled
      <input
        type="checkbox"
        bind:checked={enabled}
        on:change={on_enabled_change}
      />
    </label>
    <hr />
    <div class="page_settings_container">
      {#if !enabled}
        <div class="disabled_overlay"></div>
      {/if}
      {#await ready}
        Loading...
      {:then}
        {#if current_urlpart !== undefined}
          <div class="options_for">
            Dark Background and Light Text options for:
          </div>
          <select id="url_select" bind:value={current_urlpart}>
            {#each shown_urls as urlpart (urlpart.label)}
              <option value={urlpart}>{urlpart.label}</option>
            {/each}
          </select>
          {#if is_private}
            <div>Note: this settings will not be saved for private tabs.</div>
          {/if}
          <form>
            <ul>
              {#each Object.values(methods) as method (method.number)}
                <li>
                  <label
                    for={`method_${method.number}`}
                    class="label_click_workaround"
                  ></label>
                  <input
                    type="radio"
                    name="method"
                    bind:group={current_urlpart.configuration}
                    on:change={on_method_change}
                    value={method.number}
                    id={`method_${method.number}`}
                    class="methods"
                  />
                  <span class="label_no_click">{method.label}</span>
                </li>
              {/each}
            </ul>
          </form>
        {/if}
      {:catch error}
        <div class="error_msg">{error.message}</div>
      {/await}
    </div>
    <div>
      Configure colors, "Default" behaviour and more here: <button
        on:click={() => {
          /* see bug 1414917 */ send_message({
            action: MessageAction.OPEN_OPTIONS_PAGE,
          });
          close().catch((rejection) => console.error(rejection));
        }}>Global Preferences</button
      >
    </div>
  {:catch error}
    <div class="error_msg">{error.message}</div>
  {/await}
</main>

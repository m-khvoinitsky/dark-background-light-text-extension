<script lang="ts">
  import ColorInput from './ColorInput.svelte';
  import { query_style } from '../common/ui-style';
  import type {
    ConfiguredPages,
    Preferences,
  } from '../common/types';
  import {
    preferences,
    get_prefs,
    on_prefs_change,
    prefs_keys_with_defaults,
    set_pref,
  } from '../common/shared';
  import { methods } from '../methods/methods';

  query_style().catch((error) => console.error(error));

  let current_preferences: Preferences = [];
  let configured_pages: ConfiguredPages = {}
  async function update_prefs() {
    const saved_prefs = await get_prefs();
    current_preferences = preferences.map((pref) => ({
        ...pref,
        value: saved_prefs[pref.name],
    })) as Preferences;

    configured_pages = current_preferences.find((p) => p.name === 'configured_pages')!.value as ConfiguredPages;
  }
  update_prefs().catch((error) => console.error(error));
  on_prefs_change(() => {
    update_prefs().catch((error) => console.error(error))
    query_style().catch((error) => console.error(error));
  });

</script>

<main class="container-fluid">
  <div class="row"><div class="col-xs-12"><h2>Options</h2></div></div>
  {#each current_preferences as pref (pref.name)}
    {#if pref.type !== 'configured_pages'}
      <div class="row">
        <div class="col-xs-10 col-sm-4 col-md-4">
          <label class="full-width" for="labeled_pref_{pref.name}">{pref.title}</label>
        </div>
        {#if pref.type === 'bool'}
          <div class="col-xs-2 col-sm-4 col-md-6">
            <input
              bind:checked={pref.value}
              on:change="{(e) => set_pref(pref.name, e.currentTarget.checked)}"
              class="pref_{pref.name} full-width form-control"
              id="labeled_pref_{pref.name}"
              type="checkbox"
              data-pref-type="{pref.type}"
              >
          </div>
        {:else if pref.type === 'menulist'}
          <div class="col-xs-12 col-sm-8 col-md-6">
            <select
              on:change="{(e) => set_pref(pref.name, e.currentTarget.selectedIndex)}"
              class="pref_{pref.name} full-width form-control"
              id="labeled_pref_{pref.name}" data-pref-type={pref.type}>
              {#each pref.options as option (option.value)}
                <option selected={pref.value === parseInt(option.value, 10)}>{option.label}</option>
              {/each}
            </select>
          </div>
        {:else if pref.type === 'color' }
          <ColorInput value={pref.value} default={pref.value} on:change="{(e) => set_pref(pref.name, e.detail.value)}" class="col-xs-12 col-sm-8 col-md-6" />
        {/if}
        <div class="col-xs-12 col-sm-4 col-md-2">
          <button on:click="{() => set_pref(pref.name, prefs_keys_with_defaults[pref.name])}" class="btn btn-default full-width">Reset</button>
        </div>
      </div>
    {/if}
  {/each}

  <!-- TODO: do not show shortcuts info for Android -->
  <div class="row"><div class="col-xs-12"><h2>Shortcuts</h2></div></div>
  <div>In order to configure shortcuts, go to about:addons (Menu -&gt; Add-ons), press on the cogwheel icon, then choose "Manage Extension Shortcuts"</div>
  <a href="https://support.mozilla.org/kb/manage-extension-shortcuts-firefox">See this support article for the detais</a>

  <div class="row"><div class="col-xs-12"><h2>Configured pages</h2></div></div>
  {#each Object.entries(configured_pages) as [page, method_index] (page)}
    <div class="row configured_page">
      <div class="col-xs-12 col-sm-12 col-md-5 col-lg-8 configured_page_url">{page}</div>
      <div class="col-xs-12 col-sm-8 col-md-5 col-lg-2">{methods[method_index].label}</div>
      <div class="col-xs-12 col-sm-4 col-md-2 col-lg-2">
        <button on:click="{() => (
            set_pref(
                'configured_pages',
                Object.fromEntries(Object.entries(configured_pages).filter(([k, _]) => k !== page)),
            )
        )}" class="btn btn-default full-width">Remove</button>
      </div>
    </div>
  {:else}
    <div class="row configured_page"><div class="col-xs-12">There is no single configured page</div></div>
  {/each}
</main>

<style>
</style>

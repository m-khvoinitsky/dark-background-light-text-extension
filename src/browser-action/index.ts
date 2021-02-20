/* eslint-disable no-shadow */
import {
    get_merged_configured_common,
    get_prefs,
    set_pref,
} from '../common/shared';
import { methods } from '../methods/methods';
import { hint_marker } from '../common/generate-urls';
import { smart_generate_urls } from '../common/smart-generate-urls';
import { ConfiguredPages } from '../common/types';
import '../common/ui-style';

declare const { browser }: typeof import('webextension-polyfill-ts');

(async () => {
    function get_merged_configured(): Promise<ConfiguredPages> {
        return get_merged_configured_common(
            () => browser.runtime.sendMessage({ action: 'get_configured_private' }),
        );
    }
    async function generate_urls_with_preselect_from_configured(
        url_str: string,
    ): Promise<{list: string[], preselect?: string}> {
        let result_list = smart_generate_urls(url_str, true);
        let preselect: string | undefined;

        const merged = await get_merged_configured();
        for (const url of result_list) {
            if (url === hint_marker) {
                continue;
            }
            if (url in merged) {
                preselect = url;
                break;
            }
        }
        if (!preselect) {
            let next_is_preselected = false;
            for (const url of result_list) {
                if (url === hint_marker) {
                    next_is_preselected = true;
                    continue;
                }
                if (next_is_preselected) {
                    preselect = url;
                    break;
                }
            }
        }
        result_list = result_list.filter((url) => url !== hint_marker).reverse();

        return { list: result_list, preselect };
    }

    const CURRENT_TAB_LABEL = '< Current Tab >';
    const current_tab = (
        await browser.tabs.query({
            //                    popup in the new Fenix is now in a separate window
            currentWindow: (await browser.runtime.getPlatformInfo()).os === 'android' ? undefined : true,
            active: true,
        })
    )[0];
    const url = current_tab.url!;

    function close() {
        window.close(); // works for pop-up on desktop
        if (!current_tab.active) { // this is the case for Fennec where pop-up is actually a tab
            // activating any tab other than our fake pop-up will close pop-up
            browser.tabs.update(current_tab.id, { active: true });
        }
    }

    let message: string | boolean = false;
    try {
        await browser.tabs.executeScript(current_tab.id, {
            code: '{}',
            runAt: 'document_start',
        });
    } catch (e) {
        message = `Modification of this page is not available due to ${(await browser.runtime.getBrowserInfo()).name} restrictions`;
    }
    if (!message) {
        if (url.indexOf(browser.runtime.getURL('/')) === 0) {
            message = 'Extension\'s own internal pages are already well configured';
        }
    }

    const configured = await get_merged_configured();
    // eslint-disable-next-line prefer-const
    let { preselect, list: urls } = await generate_urls_with_preselect_from_configured(url);
    const current_url_method = await browser.runtime.sendMessage({
        action: 'get_tab_configuration',
        tab_id: current_tab.id,
    });
    if (current_url_method) {
        preselect = CURRENT_TAB_LABEL;
    }
    const isPrivate = current_tab.incognito;
    const enabled = await get_prefs('enabled');
    const body = document.querySelector('body')!;
    if ((await browser.runtime.getPlatformInfo()).os === 'android') {
        body.setAttribute('class', 'touchscreen');
    }

    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }

    async function handle_choose_url() {
        const url = (document.querySelector('#url_select') as HTMLFormElement).value;
        let current_url_method;
        if (url === CURRENT_TAB_LABEL) {
            current_url_method = await browser.runtime.sendMessage({
                action: 'get_tab_configuration',
                tab_id: current_tab.id,
            });
        } else {
            current_url_method = configured[(document.querySelector('#url_select') as HTMLFormElement).value];
        }
        if (current_url_method) {
            (document.querySelector(`#method_${current_url_method}`) as HTMLFormElement).checked = true;
        } else {
            (document.querySelector('#method_-1') as HTMLFormElement).checked = true;
        }
    }

    async function handle_method_change() {
        const methods = document.querySelectorAll('input.methods') as NodeListOf<HTMLFormElement>;
        let checked_method: HTMLFormElement;
        for (let i = 0; i < methods.length; ++i) {
            if (methods[i].checked) {
                checked_method = methods[i];
                break;
            }
        }
        const method_n = checked_method!.value;
        const url: string = (document.querySelector('#url_select') as HTMLFormElement).value;

        if (url === CURRENT_TAB_LABEL) {
            browser.runtime.sendMessage({
                action: 'set_configured_tab',
                key: current_tab.id,
                value: method_n >= 0 ? method_n : null,
            });
        } else if (isPrivate) {
            browser.runtime.sendMessage({
                action: 'set_configured_private',
                key: url,
                value: method_n >= 0 ? method_n : null,
            });
        } else {
            const configured_pages = await get_prefs('configured_pages');
            if (method_n < 0) {
                delete configured_pages[url];
            } else {
                configured_pages[url] = method_n;
            }
            await set_pref('configured_pages', configured_pages);
        }
        close();
    }

    const checkbox_label = document.createElement('label');
    checkbox_label.setAttribute('class', 'enabled_label');
    checkbox_label.textContent = 'Enabled';
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = enabled;
    checkbox.onchange = () => { set_pref('enabled', checkbox.checked).then(() => close()); };
    checkbox_label.appendChild(checkbox);
    body.appendChild(checkbox_label);

    body.appendChild(document.createElement('hr'));

    const container = document.createElement('div');
    container.setAttribute('class', 'page_settings_container');
    container.style.position = 'relative';

    if (!enabled) {
        const overlay = document.createElement('div');
        overlay.setAttribute('class', 'disabled_overlay');
        container.appendChild(overlay);
    }
    if (message) {
        const msg = document.createElement('div');
        msg.textContent = message;
        msg.setAttribute('class', 'error_msg');
        container.appendChild(msg);
    } else {
        const title = document.createElement('div');
        title.textContent = 'Dark Background and Light Text options for:';
        title.setAttribute('class', 'options_for');
        container.appendChild(title);
        const select = document.createElement('select');
        select.id = 'url_select';
        select.onchange = handle_choose_url;
        urls.push(CURRENT_TAB_LABEL);
        for (const url of urls) {
            const option = document.createElement('option');
            option.textContent = url;
            if (url === preselect) {
                option.setAttribute('selected', 'true');
            }
            select.appendChild(option);
        }
        container.appendChild(select);
        if (isPrivate) {
            const private_note = document.createElement('div');
            private_note.textContent = 'Note: this settings will not be saved for private tabs.';
            container.appendChild(private_note);
        }
        const form_methods = document.createElement('form');
        const ul_methods = document.createElement('ul');
        form_methods.appendChild(ul_methods);

        for (const method of Object.keys(methods)) {
            if (parseInt(method, 10) > -5) {  // TODO: document it somehow? (or remove?)
                const li = document.createElement('li');
                const input = document.createElement('input');
                const label = document.createElement('span');
                const label_click = document.createElement('label');
                input.type = 'radio';
                input.name = 'method';
                input.value = methods[method].number;
                input.id = `method_${methods[method].number}`;
                input.className = 'methods';
                label.textContent = methods[method].label;
                label.setAttribute('class', 'label_no_click');
                label_click.setAttribute('for', input.id);
                label_click.setAttribute('class', 'label_click_workaround');
                li.appendChild(label_click);
                li.appendChild(input);
                li.appendChild(label);
                input.onchange = handle_method_change;
                ul_methods.appendChild(li);
            }
        }
        container.appendChild(form_methods);
    }
    body.appendChild(container);
    if (!message) {
        handle_choose_url();
    }

    const preferences = document.createElement('div');
    const preferences_note = document.createTextNode('Configure colors, "Default" behaviour and more here: ');
    preferences.appendChild(preferences_note);

    const prefs_button = document.createElement('button');
    prefs_button.setAttribute('icon', 'properties');
    prefs_button.textContent = 'Global Preferences';
    prefs_button.onclick = () => { /* see bug 1414917 */ browser.runtime.sendMessage({ action: 'open_options_page' }); close(); };
    preferences.appendChild(prefs_button);

    body.appendChild(preferences);
})().catch((rejection) => console.error(rejection));

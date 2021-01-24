declare var { browser }: typeof import('webextension-polyfill-ts');
import {
    ConfiguredPages,
    ConfiguredTabs,
    RGB,
    StylesheetRenderer,
    CallbackID,
} from '../common/types';
import { Runtime, ContentScripts, Manifest, ExtensionTypes, Storage } from 'webextension-polyfill-ts';
import {
    get_prefs,
    set_pref,
    on_prefs_change,
    get_merged_configured_common,
} from '../common/shared';
import { methods } from '../methods/methods-with-stylesheets';
import { parseCSSColor } from 'csscolorparser';
import { relative_luminance } from '../common/color_utils';
import { modify_csp } from './lib';
import * as base_style from '../methods/stylesheets/base';

let platform_info: Promise<Runtime.PlatformInfo> = ('getPlatformInfo' in browser.runtime) ?
    browser.runtime.getPlatformInfo() :
    new Promise((_resolve, _reject) => {
        // TODO
    });

const configured_private: ConfiguredPages = {};
const configured_tabs: ConfiguredTabs = {};
function get_merged_configured(): Promise<ConfiguredPages> {
    return get_merged_configured_common(
        () => new Promise((resolve, _) => resolve(configured_private))
    );
}
browser.tabs.onRemoved.addListener(async (tabId) => {
    try {
        if (Object.keys(configured_private).length > 0) {
            for (let tab of await browser.tabs.query({})) {
                if (tab.incognito)
                    return;
            }
            for (let url of Object.keys(configured_private))
                delete configured_private[url];
            send_prefs({});
        }
        if (configured_tabs.hasOwnProperty(tabId))
            delete configured_tabs[tabId];
    } catch (e) {console.error(e);}
});

async function process_stylesheet(sheet: StylesheetRenderer, is_toplevel: boolean) {
    let options = await get_prefs();
    let is_darkbg = relative_luminance(parseCSSColor(options.default_background_color as string)!.slice(0, 3) as RGB) < relative_luminance(parseCSSColor(options.default_foreground_color as string)!.slice(0, 3) as RGB);
    return sheet.render({
        default_foreground_color: options.default_foreground_color as string,
        default_background_color: options.default_background_color as string,
        default_link_color: options.default_link_color as string,
        default_visited_color: options.default_visited_color as string,
        default_active_color: options.default_active_color as string,
        default_selection_color: options.default_selection_color as string,
        is_toplevel,
        is_darkbg,
    });
}

browser.runtime.onMessage.addListener(async (message, sender) => {
    try {
        if (!message.hasOwnProperty('action')) {
            console.error('bad message!', message);
            return;
        }
        switch (message.action) {
            case 'query_tabId':
                return sender.tab?.id;
            case CallbackID.INSERT_CSS:
                return await browser.tabs.insertCSS(
                    sender.tab?.id,
                    {
                        code: message.code,
                        frameId: sender.frameId,
                        cssOrigin: 'user',
                        runAt: 'document_start',
                    },
                );
            case CallbackID.REMOVE_CSS:
                return await browser.tabs.removeCSS(
                    sender.tab?.id,
                    {
                        code: message.code,
                        frameId: sender.frameId,
                        cssOrigin: 'user',
                        runAt: 'document_start',
                    },
                );
            case 'query_base_style':
                return await process_stylesheet(base_style, true);
            case 'get_configured_private':
                return configured_private;
            case 'set_configured_private':
                if (message.value === null)
                    delete configured_private[message.key];
                else
                    configured_private[message.key] = message.value;
                send_prefs({});
                break;
            // @ts-ignore: 7029
            case 'get_my_tab_configuration':
                message.tab_id = sender.tab?.id;
                // falls through
            case 'get_tab_configuration':
                if (configured_tabs.hasOwnProperty(message.tab_id))
                    return configured_tabs[message.tab_id];
                else
                    return false;
            case 'set_configured_tab':
                if (message.value === null) {
                    if (configured_tabs.hasOwnProperty(message.key))
                        delete configured_tabs[message.key];
                } else
                    configured_tabs[message.key] = message.value;
                send_prefs({});
                break;
            case 'open_options_page':
                // while runtime.openOptionsPage() works from browserAction page script, due to bug 1414917 it behaves unintuitive on Fennec so here is a workaround
                if ((await platform_info).os === 'android')
                    setTimeout(() => browser.runtime.openOptionsPage(), 500);
                else
                    browser.runtime.openOptionsPage();
                break;
            case 'is_commands_update_available':
                return Object.prototype.hasOwnProperty.call(browser, 'commands') && Object.prototype.hasOwnProperty.call(browser.commands, 'update');
            case 'query_parent_method_number':
                if (sender.frameId === 0) {
                    console.error('Top-level frame requested some info about its parent. That should not happen. The sender is:', sender);
                    return await get_prefs('default_method');
                }
                return await browser.tabs.sendMessage(
                    sender.tab!.id!,
                    { action: 'get_method_number' },
                    { frameId: 0 },
                );
            default:
                console.error('bad message 2!', message);
                break;
        }
    } catch (e) { console.exception(e); }
});

const prev_scripts: ContentScripts.RegisteredContentScript[] = [];
async function send_prefs(changes: {[s: string]: Storage.StorageChange}) {
    prev_scripts.forEach(cs => cs.unregister());
    prev_scripts.length = 0;
    let from_manifest = (browser.runtime.getManifest() as Manifest.WebExtensionManifest).content_scripts![0];
    let new_data: ContentScripts.RegisteredContentScriptOptions = {matches: ["<all_urls>"]};
    let rendered_stylesheets: {[key: string]: string} = {};
    for (let css_renderer of Array.from(new Set(Object.values(methods).map(m => m.stylesheets).flat()))) {
        rendered_stylesheets[`${css_renderer.name}_iframe`] = await process_stylesheet(css_renderer, false);
        rendered_stylesheets[`${css_renderer.name}_toplevel`] = await process_stylesheet(css_renderer, true);
    }
    let code = `
        if (typeof content_script_state === 'undefined') { /* #226 part 1 workaround */
            window.content_script_state = 'registered_content_script_first';
        }

        window.prefs = ${ JSON.stringify(await get_prefs()) };
        window.merged_configured = ${ JSON.stringify(await get_merged_configured()) };
        window.configured_tabs = ${ JSON.stringify(configured_tabs) };
        window.rendered_stylesheets = ${ JSON.stringify(rendered_stylesheets) };
        if (window.content_script_state !== 'registered_content_script_first') { /* #226 part 1 workaround */
            window.do_it(${ JSON.stringify(changes) });
        }
    `;
    for (let key in from_manifest) {
        if (key === 'js') {
            new_data['js'] = [{ code }];
        } else {
            // convert to camelCase
            let new_key = key.split('_').map((el, index) => index === 0 ? el : el.charAt(0).toUpperCase() + el.slice(1)).join('');
            (new_data as any)[new_key] = (from_manifest as any)[key];
        }
    }
    prev_scripts.push(await browser.contentScripts.register(new_data));

    // same for already loaded pages
    let new_data_for_tabs: ExtensionTypes.InjectDetails = {code};
    for (let key in new_data) {
        if (['allFrames', 'matchAboutBlank', 'runAt'].indexOf(key) >= 0) {
            (new_data_for_tabs as any)[key] = (new_data as any)[key];
        }
    }
    for (let tab of await browser.tabs.query({})) {
        browser.tabs.executeScript(
            tab.id,
            new_data_for_tabs,
        );
    }
}
send_prefs({});
on_prefs_change(send_prefs);


if (browser.hasOwnProperty('commands')) {
    browser.commands.onCommand.addListener(async (name) => {
        try {
            let current_tab;
            switch (name) {
                case 'global_toggle_hotkey':
                    set_pref('enabled', !(await get_prefs('enabled')));
                    break;
                case 'tab_toggle_hotkey':
                    current_tab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
                    if (configured_tabs.hasOwnProperty(current_tab.id!))
                        delete configured_tabs[current_tab.id!];
                    else
                        configured_tabs[current_tab.id!] = '0';
                    send_prefs({});
                    break;
                default:
                    console.error('bad command');
                    break;
            }
        } catch (e) { console.exception(e); }
    });
}

get_prefs('do_not_set_overrideDocumentColors_to_never').then(val => {
    if (!val) {
        // The extension can barely do anything when overrideDocumentColors == always
        // or overrideDocumentColors == high-contrast-only is set and high contrast mode is in use
        browser.browserSettings.overrideDocumentColors.set({value: 'never'}).catch(error => console.error(error));
    }
});

browser.webRequest.onHeadersReceived.addListener(
    details => {
        try {
            return {
                responseHeaders: details.responseHeaders!.map(modify_csp),
            };
        } catch (e) {
            console.error(e);
            return {};
        }
    },
    {
        urls: ['<all_urls>'],
        types: ['main_frame'],
    },
    [
        'blocking',
        'responseHeaders',
    ],
);

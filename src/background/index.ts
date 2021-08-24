import { parseCSSColor } from 'csscolorparser-ts';
import {
    Runtime,
    ContentScripts,
    Manifest,
    ExtensionTypes,
    Storage,
    WebRequest,
    Tabs,
} from 'webextension-polyfill-ts';
import {
    ConfiguredPages,
    ConfiguredTabs,
    StylesheetRenderer,
    CallbackID,
} from '../common/types';
import {
    get_prefs,
    set_pref,
    on_prefs_change,
    get_merged_configured_common,
    PrefsWithValues,
} from '../common/shared';
import { methods } from '../methods/methods-with-stylesheets';
import {
    relative_luminance,
    strip_alpha,
} from '../common/color_utils';
import {
    modify_cors,
    modify_csp,
    version_lt,
} from './lib';
import * as base_style from '../methods/stylesheets/base';

declare const { browser }: typeof import('webextension-polyfill-ts');

const platform_info: Promise<Runtime.PlatformInfo> = ('getPlatformInfo' in browser.runtime)
    ? browser.runtime.getPlatformInfo()
    : Promise.reject();

const configured_private: ConfiguredPages = {};
const configured_tabs: ConfiguredTabs = {};
function get_merged_configured(): Promise<ConfiguredPages> {
    return get_merged_configured_common(
        () => Promise.resolve(configured_private),
    );
}
browser.tabs.onRemoved.addListener(async (tabId) => {
    try {
        if (Object.keys(configured_private).length > 0) {
            for (const tab of await browser.tabs.query({})) {
                if (tab.incognito) {
                    return;
                }
            }
            for (const url of Object.keys(configured_private)) {
                delete configured_private[url];
            }
            send_prefs({});
        }
        if (Object.prototype.hasOwnProperty.call(configured_tabs, tabId)) {
            delete configured_tabs[tabId];
        }
    } catch (e) { console.error(e); }
});

function process_stylesheet(
    sheet: StylesheetRenderer,
    is_toplevel: boolean,
    // it's not very nice to make callers of the function query prefs themselves
    // however, this enables them to cache the value
    prefs: PrefsWithValues,
) {
    const is_darkbg = relative_luminance(
        strip_alpha(parseCSSColor(prefs.default_background_color as string)!),
    ) < relative_luminance(
        strip_alpha(parseCSSColor(prefs.default_foreground_color as string)!),
    );
    return sheet.render({
        default_foreground_color: prefs.default_foreground_color as string,
        default_background_color: prefs.default_background_color as string,
        default_link_color: prefs.default_link_color as string,
        default_visited_color: prefs.default_visited_color as string,
        default_active_color: prefs.default_active_color as string,
        default_selection_color: prefs.default_selection_color as string,
        is_toplevel,
        is_darkbg,
    });
}

browser.runtime.onMessage.addListener(async (message, sender) => {
    try {
        // TODO: statically typed runtime.onMessage
        if (!Object.prototype.hasOwnProperty.call(message, 'action')) {
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
                return process_stylesheet(base_style, true, await get_prefs());
            case 'get_configured_private':
                return configured_private;
            case 'set_configured_private':
                if (message.value === null) {
                    delete configured_private[message.key];
                } else {
                    configured_private[message.key] = message.value;
                }
                send_prefs({});
                break;
            // @ts-ignore: 7029
            case 'get_my_tab_configuration':
                message.tab_id = sender.tab?.id; // eslint-disable-line no-param-reassign
                // falls through
            case 'get_tab_configuration':
                if (Object.prototype.hasOwnProperty.call(configured_tabs, message.tab_id)) {
                    return configured_tabs[message.tab_id];
                }
                return false;
            case 'set_configured_tab':
                if (message.value === null) {
                    if (Object.prototype.hasOwnProperty.call(configured_tabs, message.key)) {
                        delete configured_tabs[message.key];
                    }
                } else {
                    configured_tabs[message.key] = message.value;
                }
                send_prefs({});
                break;
            case 'open_options_page':
                // while runtime.openOptionsPage() works from browserAction page script,
                // due to bug 1414917 it behaves unintuitive on Fennec so here is a workaround
                if ((await platform_info).os === 'android') {
                    setTimeout(() => browser.runtime.openOptionsPage(), 500);
                } else {
                    browser.runtime.openOptionsPage();
                }
                break;
            case 'is_commands_update_available':
                return (
                    Object.prototype.hasOwnProperty.call(browser, 'commands')
                    && Object.prototype.hasOwnProperty.call(browser.commands, 'update')
                );
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
    } catch (e) { console.error(e); }
});

const prev_scripts: ContentScripts.RegisteredContentScript[] = [];
async function send_prefs(changes: {[s: string]: Storage.StorageChange}) {
    prev_scripts.forEach((cs) => cs.unregister());
    prev_scripts.length = 0;
    const from_manifest = (
        browser.runtime.getManifest() as Manifest.WebExtensionManifest
    ).content_scripts![0];
    const new_data: ContentScripts.RegisteredContentScriptOptions = { matches: ['<all_urls>'] };
    const rendered_stylesheets: {[key: string]: string} = {};
    const prefs = await get_prefs();
    for (const css_renderer of new Set(Object.values(methods).map((m) => m.stylesheets).flat())) {
        rendered_stylesheets[`${css_renderer.name}_iframe`] = process_stylesheet(css_renderer, false, prefs);
        rendered_stylesheets[`${css_renderer.name}_toplevel`] = process_stylesheet(css_renderer, true, prefs);
    }
    const code = `
        if (typeof content_script_state === 'undefined') { /* #226 part 1 workaround */
            window.content_script_state = 'registered_content_script_first';
        }

        window.prefs = ${JSON.stringify(await get_prefs())};
        window.merged_configured = ${JSON.stringify(await get_merged_configured())};
        window.configured_tabs = ${JSON.stringify(configured_tabs)};
        window.rendered_stylesheets = ${JSON.stringify(rendered_stylesheets)};
        if (window.content_script_state !== 'registered_content_script_first') { /* #226 part 1 workaround */
            window.do_it(${JSON.stringify(changes)});
        }
    `;
    for (const key of Object.keys(from_manifest)) {
        if (key === 'js') {
            new_data.js = [{ code }];
        } else {
            // convert to camelCase
            const new_key = key.split('_').map((el, index) => (index === 0 ? el : el.charAt(0).toUpperCase() + el.slice(1))).join('');
            (new_data as any)[new_key] = (from_manifest as any)[key];
        }
    }
    prev_scripts.push(await browser.contentScripts.register(new_data));

    // same for already loaded pages
    const new_data_for_tabs: ExtensionTypes.InjectDetails = { code };
    for (const key of Object.keys(new_data)) {
        if (['allFrames', 'matchAboutBlank', 'runAt'].indexOf(key) >= 0) {
            (new_data_for_tabs as any)[key] = (new_data as any)[key];
        }
    }
    for (const tab of await browser.tabs.query({})) {
        browser.tabs.executeScript(
            tab.id,
            new_data_for_tabs,
        );
    }
}
send_prefs({});
on_prefs_change(send_prefs);

if (Object.prototype.hasOwnProperty.call(browser, 'commands')) {
    browser.commands.onCommand.addListener(async (name) => {
        try {
            let current_tab: Tabs.Tab;
            switch (name) {
                case 'global_toggle_hotkey':
                    set_pref('enabled', !(await get_prefs('enabled')));
                    break;
                case 'tab_toggle_hotkey':
                    [current_tab] = await browser.tabs.query({ currentWindow: true, active: true });
                    if (Object.prototype.hasOwnProperty.call(configured_tabs, current_tab.id!)) {
                        delete configured_tabs[current_tab.id!];
                    } else {
                        configured_tabs[current_tab.id!] = '0';
                    }
                    send_prefs({});
                    break;
                default:
                    console.error('bad command');
                    break;
            }
        } catch (e) { console.error(e); }
    });
}

get_prefs('do_not_set_overrideDocumentColors_to_never').then((val) => {
    if (!val) {
        // The extension can barely do anything when overrideDocumentColors == always
        // or overrideDocumentColors == high-contrast-only is set and high contrast mode is in use
        browser.browserSettings.overrideDocumentColors.set({ value: 'never' }).catch((error) => console.error(error));
    }
});

browser.runtime.onInstalled.addListener((details) => {
    if (
        details.reason === 'install'
        || (
            details.reason === 'update'
            && details.previousVersion
            && version_lt(details.previousVersion, '0.7.6')
        )
    ) {
        browser.webRequest.handlerBehaviorChanged();
    }
});

browser.webRequest.onHeadersReceived.addListener(
    (details) => {
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

function is_probably_service_worker(details: WebRequest.OnHeadersReceivedDetailsType): boolean {
    if (!details.originUrl) {
        return false;
    }
    const origin_url = new URL(details.originUrl);
    // likely a request from Service Worker
    if (
        details.type === 'xmlhttprequest'
        && details.tabId === -1
        && (
            origin_url.protocol === 'https:'
            || origin_url.hostname === 'localhost'
            || origin_url.hostname === '127.0.0.1'
            || origin_url.hostname === '[::1]'
        )
    ) {
        return true;
    }
    return false;
}

function get_content_type(headers?: WebRequest.HttpHeaders): string | undefined {
    return headers?.find(
        (h) => h.name.toLowerCase() === 'content-type',
    )?.value;
}

browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (
            details.type === 'stylesheet'
            || (
                is_probably_service_worker(details)
                && get_content_type(details.responseHeaders)?.startsWith('text/css')
            )
        ) {
            try {
                return {
                    responseHeaders: modify_cors(details.responseHeaders!, details),
                };
            } catch (e) {
                console.error(e);
                return {};
            }
        }
        return {};
    },
    {
        urls: ['<all_urls>'],
        types: [
            'stylesheet',
            'xmlhttprequest',
        ],
    },
    [
        'blocking',
        'responseHeaders',
    ],
);

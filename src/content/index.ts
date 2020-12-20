declare var { browser }: typeof import('webextension-polyfill-ts');
import type { Storage } from 'webextension-polyfill-ts'
import { AddonOptions, ConfiguredPages, ConfiguredTabs, MethodIndex, MethodMetadata, MethodExecutor } from '../common/types';
import { methods } from '../common/shared';
import { StylesheetColorProcessor } from './methods/stylesheet-color-processor';
import { InvertMethod } from './methods/invert';
import { generate_urls } from '../common/generate-urls';

methods['1'].executor = StylesheetColorProcessor;
methods['3'].executor = InvertMethod;

const tabId_promise = browser.runtime.sendMessage({action: 'query_tabId'});
let is_iframe: boolean;
try {
    is_iframe = window.self !== window.top;
} catch (e) {
    is_iframe = true;
}

declare global {
    interface Window {
        content_script_state: 'normal_order' | 'registered_content_script_first' | 'does not matters anymore' | undefined,
        prefs: AddonOptions,
        merged_configured: ConfiguredPages,
        configured_tabs: ConfiguredTabs,
        rendered_stylesheets: {[key: string]: string},
        do_it: (changes: {[s: string]: Storage.StorageChange}) => Promise<void>,
    }
}

try {
// @ts-ignore: 2454
if (typeof window.content_script_state === 'undefined') { /* #226 part 1 workaround */
    window.content_script_state = 'normal_order';
}

async function get_method_for_url(url: string): Promise<MethodMetadata> {
    if (window.prefs.enabled) {
        if (is_iframe) {
            let parent_method_number = await browser.runtime.sendMessage({action: 'query_parent_method_number'});
            if (methods[parent_method_number].affects_iframes) {
                return methods[0];
            } else if (url === 'about:blank' || url === 'about:srcdoc') {
                return methods[parent_method_number];
            }
        }
        // TODO: get rid of await here, https://bugzilla.mozilla.org/show_bug.cgi?id=1574713
        let tab_configuration: MethodIndex | boolean = false;
        if (Object.keys(window.configured_tabs).length > 0) {
            let tabId = await tabId_promise;
            tab_configuration = window.configured_tabs.hasOwnProperty(tabId) ? window.configured_tabs[tabId] : false;
        }
        if (tab_configuration !== false)
            return methods[tab_configuration];

        let configured_urls = Object.keys(window.merged_configured);
        for (let gen_url of generate_urls(url)) {
            if (configured_urls.indexOf(gen_url) >= 0) {
                return methods[window.merged_configured[gen_url]];
            }
        }
        return methods[window.prefs.default_method];
    } else
        return methods[0];
}

let current_method: MethodMetadata;
let resolve_current_method_promise: ((mmd: MethodMetadata) => void) | null;
let current_method_promise: Promise<MethodMetadata> = new Promise((resolve: (mmd: MethodMetadata) => void) => { resolve_current_method_promise = resolve; });
let current_method_executor: MethodExecutor | undefined;
window.do_it = async function do_it(changes: {[s: string]: Storage.StorageChange}) {
    try {
        let new_method = await get_method_for_url(window.document.documentURI);
        if (resolve_current_method_promise) {
            resolve_current_method_promise(new_method);
            resolve_current_method_promise = null;
        } else {
            current_method_promise = Promise.resolve(new_method);
        }
        if (
            !current_method ||
            new_method.number !== current_method.number ||
            Object.keys(changes).some(key => key.indexOf('_color') >= 0) // TODO: better condition
        ) {
            for (let node of document.querySelectorAll('style[class="dblt-ykjmwcnxmi"]')) {
                node.parentElement!.removeChild(node);
            }
            for (let css of new_method.stylesheets) {
                let style_node = document.createElement('style');
                style_node.setAttribute('data-source', css);
                style_node.classList.add('dblt-ykjmwcnxmi');
                style_node.innerText = window.rendered_stylesheets[`${css}_${ is_iframe ? 'iframe' : 'toplevel' }`];
                document.documentElement.appendChild(style_node);
                if (!document.body) {
                    // this should move our element after <body> which is important in specificity fight
                    document.addEventListener('DOMContentLoaded', function () {
                        document.documentElement.appendChild(style_node);
                    });
                }
            }
            if (current_method_executor) {
                current_method_executor.unload_from_window();
                current_method_executor = undefined;
            }
            if (new_method.executor) {
                current_method_executor = new new_method.executor(window, window.prefs);
                current_method_executor.load_into_window();
            }
        }
        current_method = new_method;
    } catch (e) { console.exception(e); }
}

interface GetMethodNumberMsg {
    action: 'get_method_number'
}
browser.runtime.onMessage.addListener(async (message: GetMethodNumberMsg, _sender) => {
    try {
        if (!message.action) {
            console.error('bad message!', message);
            return;
        }
        switch (message.action) {
            case 'get_method_number':
                return (await current_method_promise).number;
            default:
                console.error('bad message 2!', message);
                return;
        }
    } catch (e) { console.exception(e); return; }
});

if (window.content_script_state === 'registered_content_script_first') { /* #226 part 1 workaround */
    window.do_it({});
    window.content_script_state = 'does not matters anymore';
}
} catch (e) { console.exception(e); }

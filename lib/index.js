"use strict";

const self = require('sdk/self');
const webExtension = require("sdk/webextension");
const { PageMod } = require('sdk/page-mod');
const tabs = require("sdk/tabs");
const { UI, ui_type } = require('./ui');
const { isPrivate } = require("sdk/private-browsing");
const simple_prefs = require("sdk/simple-prefs");
const events = require("sdk/system/events");
const { getTargetWindow } = require('sdk/content/mod');
const stylesheet_service = require('./stylesheet-service');
const { process_stylesheet } = require('./methods/abstract-method');
const about_config = require('sdk/preferences/service');
const { processes, remoteRequire } = require("sdk/remote/parent");
const sdk_url = require('sdk/url');
const { get_sytem_font_style } = require('./system-font');

const isFennec = require('sdk/system/xul-app').ID === '{aa3c5121-dab2-40e2-81ca-7ea25febc110}';

let browser_promise = webExtension.startup();
let browser;

var loaded_global_stylesheet;

const configured_private = {};
events.on("last-pb-context-exited", function (event) {
    for (let url in configured_private) {
        delete configured_private[url];
    }
}, true);

const methods = require('./methods/methods').get_methods();
var configured_pages;
const preferences = [
    {
        type: 'bool',
        name: 'enabled',
        value: true,
        title: 'Enabled',
    },
    {
        title: 'Default method of changing page colors',
        value: 1,
        type: 'menulist',
        options: Object.keys(methods).filter(key=>(parseInt(key) >= 0)).map(key=>
            ({
                label: methods[key].label,
                value: key,
            })),
        name: 'default_method',
    },
    {
        type: 'color',
        name: 'default_foreground_color',
        value: '#ffffff',
        title: 'Default foreground color',
    },
    {
        type: 'color',
        name: 'default_background_color',
        value: '#000000',
        title: 'Default background color',
    },
    {
        type: 'color',
        name: 'default_link_color',
        value: '#7fd7ff',
        title: 'Default link color',
    },
    {
        type: 'color',
        name: 'default_visited_color',
        value: '#ffafff',
        title: 'Default visited link color',
    },
    {
        type: 'color',
        name: 'default_active_color',
        value: '#ff0000',
        title: 'Default active link color',
    },
    {
        type: 'color',
        name: 'default_selection_color',
        value: '#8080ff',
        title: 'Default selection color',
    },
    {
        type: 'configured_pages',
        name: 'configured_pages',
        value: {},
        title: 'configured_pages',
    },
];
const prefs_keys_with_defaults = (() => {
    let result = {};
    preferences.forEach(pref => { result[pref.name] = pref.value; });
    return result;
})();
let get_prefs;
let set_pref;

const preferences_workers = [];

const built_in_configured = {
    'chrome://browser/content/browser.xul': '0',
    'chrome://browser/content/history/history-panel.xul': 0,
    'chrome://browser/content/bookmarks/bookmarksPanel.xul': 0,
    /*'chrome://browser/content/': '0', - there are iframes in about:preferences that points here, do not ignore it*/
    'chrome://browser/content/devtools/': '0', // Developer tools have good dark theme
    'chrome://devtools/content/': '0',
    'about:devtools-toolbox': '0',
    //'about:addons': '4'
    'chrome://navigator/content/navigator.xul': '0', // SeaMonkey
};

function get_merged_configured() {
    let result = {};
    for (let att in built_in_configured) {
        result[att] = built_in_configured[att];
    }
    for (let att in configured_pages) {
        result[att] = configured_pages[att];
    }
    for (let att in configured_private) {
        result[att] = configured_private[att];
    }
    return result
}
const protocol_and_www = new RegExp('^(?:(?:https?)|(?:ftp))://(?:www\\.)?');
async function get_method_for_url(url) {
    //TODO: merge somehow part of this code with generate_urls()
    let method = 'unspecified';
    let { enabled, default_method } = await get_prefs(['enabled', 'default_method']);
    if (enabled) {
        let merged_configured = get_merged_configured();
        if (url.search(protocol_and_www) >= 0) {
            url = url.replace(protocol_and_www, '');
            // dirty removing of portnumber from url
            //TODO: do not remove it but handle properly
            let colon = url.indexOf(':');
            let origin_end = url.indexOf('/');
            if (origin_end === -1) origin_end = url.length;
            if (colon < origin_end && url.substring(colon + 1, origin_end).search(/^(\d)+$/) === 0)
                url = url.substr(0, colon) + url.substr(origin_end);
        }
        let pure_domains = Object.keys(merged_configured).filter(key => (key.indexOf('/') < 0));
        let with_path = Object.keys(merged_configured).filter(key => (key.indexOf('/') >= 0));
        if (with_path.sort((a, b) => a.length < b.length).some(saved_url => {
                if (url.indexOf(saved_url) === 0) {
                    method = methods[merged_configured[saved_url]];
                    return true;
                }
            })) {
        } // if .some() returns true => we found it!
        else if (pure_domains.sort((a, b) => a.length < b.length).some(saved_url => {
                let saved_arr = saved_url.split('.').reverse();
                let test_arr = url.split('/')[0].split('.').reverse();
                if (saved_arr.length > test_arr.length)
                    return false;
                if (saved_arr.every((part, index) => (part === test_arr[index]))) {
                    method = methods[merged_configured[saved_url]];
                    return true;
                }
            })) {
        }
        else
            method = methods[default_method];
        return method;
    } else
        return methods[0];
}
async function update_global_sheet(unload) {
    if (loaded_global_stylesheet && stylesheet_service.sheetRegistered(loaded_global_stylesheet, 'user'))
        stylesheet_service.unregisterSheet(loaded_global_stylesheet, 'user');
    if (!unload) {
        loaded_global_stylesheet = process_stylesheet(self.data.url('methods/global.css'), await get_prefs());
        stylesheet_service.loadAndRegisterSheet(loaded_global_stylesheet, 'user');
    }
}
async function update_options() {
    let prefs = await get_prefs();
    processes.port.emit('update_options', prefs);
    update_global_sheet(!(prefs['enabled']));
}
function settings_changed(data) {
    let { url, method } = data;
    if (!data.isPrivate) {
        if (method < 0) {
            delete configured_pages[url]
        } else {
            configured_pages[url] = method;
        }
        set_pref('configured_pages', configured_pages);
    } else {
        if (method < 0) {
            delete configured_private[url]
        } else {
            configured_private[url] = method;
        }
    }
    processes.port.emit('update_applied_methods');
}
function generate_urls(url_param) {
    let url_str;
    if (!url_param)
        url_str = tabs.activeTab.url;
    else
        url_str = url_param;
    let url_obj = sdk_url.URL(url_str);

    let result_list = [];
    let preselect;

    let before_path;
    if (['http', 'https', 'ftp'].indexOf(url_obj.scheme) >= 0) {
        let tld = sdk_url.getTLD(url_str);
        let hostname_short = url_obj.hostname
            .replace(new RegExp('^www\\.'), '');
        if (tld) {
            hostname_short = hostname_short
                .replace(new RegExp('\\.' + tld.split('.').join('\\.') + '$'), '');
        } // 'else' is most likely bare IP

        if (url_obj.hostname === tld) { // domain itself is top-level (eg. localhost)
            result_list.push(tld);
            preselect = tld;
            before_path = tld;
        } else {
            hostname_short.split('.').reverse().forEach((part, index, parts) => {
                let result = parts.slice(0, index + 1).reverse().join('.') + (!!tld ? ('.' + tld) : '');
                result_list.push(result);
                preselect = result;
                before_path = result;
            });
        }
        if (url_obj.port) { /* //TODO:
            let result = before_path + ':' + url_obj.port;
            result_list.push(result);
            preselect = result;
            before_path = result; */
        }
    } else {
        if (url_obj.protocol !== url_obj.origin) {
            result_list.push(url_obj.origin);
            preselect = url_obj.origin;
        }
        before_path = url_obj.origin;
    }

    let path_starts_with_slash = false;
    url_obj.pathname.split('/').forEach((part, index, parts) => {
        if (part.length === 0 && index === 0) {
            // if path starts with '/'
            path_starts_with_slash = true;
            return;
        }
        if (part.length === 0 && index === 1)
            return; // path is only '/'
        let result = path_starts_with_slash ?
            [before_path].concat( parts.slice(1, index + 1) ).join('/') :
            before_path + parts.slice(0, index + 1).join('/');
        result_list.push(result);
        if (!(preselect))
            preselect = result;
    });

    let merged = get_merged_configured();
    result_list.forEach(url => {
        if (url in merged)
            preselect = url;
    });

    return { list: result_list, preselect };
}
async function get_settings_init_params() {
    return {
        enabled: await get_prefs('enabled'),
        methods: methods,
        configured: get_merged_configured(),
        //TODO: pass url here:
        urls: generate_urls(),
        /* BAD NEWS: It seems that isPrivate(Tab) is broken on android! But isPrivate(nsIDOMWindow) works //TODO: test with android */
        isPrivate: isFennec ? isPrivate(getTargetWindow(tabs.activeTab)) : isPrivate(tabs.activeTab),
        isTouchscreen: ui_type === 'android',
        style: get_sytem_font_style()
    }
}

simple_prefs.on('open_addon_prefs', () => { tabs.open(self.data.url('preferences.html')) });

const fx_prefs = {
    'browser.display.use_system_colors': false,
    'browser.display.document_color_use': 1, // 'Override the colors specified by the page with my selections above' => 'Never'
};

const message_listeners = {
    query_method_for_url: (proc, data) => {
        Promise.all([
            get_method_for_url(data.url),
            get_prefs()
        ]).then(results => {
            let method = results[0];
            let prefs = results[1];
            proc.port.emit('result_method_for_url', {
                method: method.number,
                prefs,
                index: data.index
            });
        });
    }
};

exports.main = async function(options, callbacks) {
    try {
        let resolve_map = new Map();
        let we_msg_id_counter = 0;

        browser = (await browser_promise).browser;
        let we_port = await (new Promise((resolve, reject) => browser.runtime.onConnect.addListener(port => resolve(port))));
        we_port.onMessage.addListener(msg => {
            if (resolve_map.has(msg.id)) {
                if ('response' in msg)
                    resolve_map.get(msg.id)['resolve'](msg.response);
                else if ('rejection' in msg)
                    resolve_map.get(msg.id)['reject'](msg.rejection);
                else
                    console.error('something went wrong: message has neither response nor rejection', msg);
                resolve_map.delete(msg.id);
            } else {
                console.error('something went wrong: unknown message id', msg);
            }
        });
        function sendMessage(msg) {
            msg['id'] = we_msg_id_counter++;
            we_port.postMessage(msg);
            return new Promise((resolve, reject) => {
                resolve_map.set(msg.id, {resolve, reject})
            });
        }
        get_prefs = prefs => sendMessage({action: 'get_prefs', prefs});
        set_pref = (pref, value) => sendMessage({action: 'set_pref', pref, value});

        await sendMessage({action: 'initial_data', preferences, prefs_keys_with_defaults});

        if (!simple_prefs.prefs['migrated-to-webextensions']) {
            if ('enabled' in simple_prefs.prefs) {
                // migrating
                let promises = [];
                for (let key in prefs_keys_with_defaults) {
                    if (key === 'configured_pages')
                        promises.push(set_pref(key, JSON.parse(simple_prefs.prefs[key])));
                    else
                        promises.push(set_pref(key, simple_prefs.prefs[key]));
                    delete simple_prefs.prefs[key];
                }
                await Promise.all(promises);
            } // else fresh install
            simple_prefs.prefs['migrated-to-webextensions'] = true;
        }

        configured_pages = await get_prefs('configured_pages');

        PageMod({
            include: self.data.url('preferences.html'),
            attachTo: ['existing', 'top', 'frame'],
            contentScriptFile: self.data.url('preferences.js'),
            onAttach: function(worker) {
                preferences_workers.push(worker);
                worker.on('detach', () => {
                    let index = preferences_workers.indexOf(worker);
                    if (index >= 0) // for some reason, detach emitted twice
                        preferences_workers.splice(index, 1);
                    /*else
                        console.log('index < 0', (new Error()).stack);*/
                });
                worker.port.on('settings-changed', data => {
                    set_pref(data.name, data.value);
                });
                worker.port.on('settings-reset', name => {
                    set_pref(name, prefs_keys_with_defaults[name]);
                });
                worker.port.on('remove-configured', url => {
                    settings_changed({
                        url: url,
                        method: -1,
                        isPrivate: false
                    });
                });
                worker.port.emit('style', get_sytem_font_style());
                get_prefs().then(prefs => {
                    worker.port.emit('init', {
                        isTouchscreen: ui_type === 'android',
                        preferences: preferences.map(p => {
                            let pref = {};
                            for (let k in p) {
                                if (k === 'value') {
                                    pref['value'] = prefs[p.name];
                                } else {
                                    pref[k] = p[k];
                                }
                            }
                            return pref;
                        }).filter(p => (p.name !== 'configured_pages')), //TODO: do not filter it out. Allow to edit configured pages.
                        configured_pages: configured_pages,
                        methods: methods
                    });
                });
            }
        });

        browser.runtime.onMessage.addListener(message => {
            if (message.action && message.action === 'preferences_change') {
                let changes = message.changes;

                for (let key in changes) {
                    let value = changes[key]['newValue'];
                    preferences_workers.forEach(worker => {
                        let data;
                        let event;
                        if (key === 'configured_pages') {
                            event = 'refresh-configured';
                            data = configured_pages;
                        } else {
                            event = 'refresh';
                            data = {
                                name: key,
                                value
                            };
                        }
                        worker.port.emit(event, data);
                    });

                    //TODO: pref change event handler becomes messy. refactor to avoid it.
                    if (['default_method', 'enabled', 'configured_pages'].indexOf(key) >= 0) {
                        if (key === 'configured_pages')
                            return;
                        if (key === 'enabled')
                            update_global_sheet(!(value));
                        processes.port.emit('update_applied_methods');
                    }
                    else
                        update_options();
                }
            }
        });

        let ui = new UI({
            id: 'configure-for-current-tab',
            label: 'Dark Background and Light Text',
            labelShort: 'Dark bg & Light text',
            tooltip: 'Dark Background and Light Text options for current web page',
            height: 350,
            icon: {
                "16": "./icon16.png",
                "24": "./icon24.png",
                "32": "./icon32.png",
                "64": "./icon64.png"
            },
            contentURL: self.data.url("configure-for-current-tab-panel.html"),
            contentScriptFile: self.data.url("configure-for-current-tab-panel.js")
        });
        ui.on('panel-show', async function() {ui.emit('init', await get_settings_init_params())});
        ui.on('panel-port-settings-changed', data => {
            ui.hide();
            settings_changed(data);
        });
        ui.on('panel-port-open-preferences', () => {
            ui.hide();
            // TODO: move isPrivate(tab) to function
            tabs.open({
                url: self.data.url('preferences.html'),
                isPrivate: isFennec ? isPrivate(getTargetWindow(tabs.activeTab)) : isPrivate(tabs.activeTab)
            });
        });
        ui.on('panel-port-enabled-change', enabled => {
            ui.hide();
            set_pref('enabled', enabled);
        });

        update_global_sheet(!(await get_prefs('enabled')));
        //TODO: watch for this options change and warn user
        Object.keys(fx_prefs).forEach(pref => about_config.set(pref, fx_prefs[pref]));

        remoteRequire(self.data.url('../lib/process-script.js'));
        for (let message in message_listeners)
            processes.port.on(message, message_listeners[message]);
    } catch (e) {console.error(e)}
};

exports.onUnload = function(reason) {
    Object.keys(fx_prefs).forEach(pref => about_config.reset(pref));

    if (reason !== 'shutdown') { // no need to do heavy things on shutdown
        update_global_sheet(true);

        for (let message in message_listeners)
            processes.port.off(message, message_listeners[message]);
        processes.port.emit('unload_all');
        // remove it?
    }
};

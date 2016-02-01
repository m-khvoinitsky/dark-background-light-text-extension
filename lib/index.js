"use strict";

//http://joyreactor.cc/post/2116903 - hover comments
// darkest text colors: #9DB8C7 (http://linz.by/)

const self = require('./self');
const worker = require('sdk/content/worker');
const base64 = require("sdk/base64");
const lang_type = require('sdk/lang/type');
const { attachTo } = require("sdk/content/mod");
const { Style } = require("sdk/stylesheet/style");
const { PageMod } = require('sdk/page-mod');
const tabs = require("sdk/tabs");
const { setTimeout, setInterval } = require("sdk/timers");
const { UI, ui_type } = require('./ui');
const xul_app = require('sdk/system/xul-app');
const { isPrivate } = require("sdk/private-browsing");
const simple_prefs = require("sdk/simple-prefs");
const simplestorage = require("sdk/simple-storage");
const events = require("sdk/system/events");
const { getTargetWindow } = require('sdk/content/mod');
const stylesheet_utils = require("sdk/stylesheet/utils");
const stylesheet_service = require('./stylesheet-service');
const { process_stylesheet } = require('./methods/abstract-method');
const about_config = require('sdk/preferences/service');
const { gppmm } = require('./gppmm');
const sdk_url = require('sdk/url');
//const { sqlite } = require('./sqlite');

const isFennec = xul_app.is('Fennec');

/*sqlite({path: 'dark-background-light-text-'+self.id+'.sqlite'}).then(
    connection => {

    },
    error => {

    }
);*/

var loaded_global_stylesheet;
const processedDocuments = new WeakMap();

if (!simplestorage.storage.configured)
    simplestorage.storage.configured = {};
const configured_private = {};
events.on("last-pb-context-exited", function (event) {
    for (let url in configured_private) {
        delete configured_private[url];
    }
}, true);

// copy of methods from process-script.js without executors
//TODO: get rid of copy-paste
const methods = {
    '-1': {
        number: '-1',
        label: 'Default'
    },
    0: {
        number: '0',
        label: 'Disabled'
    },
    1: {
        number: '1',
        label: 'Stylesheet processor'
    },
    2: {
        number: '2',
        label: 'Simple CSS'
    },
    3: {
        number: '3',
        label: 'Invert'
    }
};

const preferences = [
    {
        title: "Default method of changing page colors",
        value: 1,
        type: "menulist",
        options: Object.keys(methods).filter(key=>(parseInt(key) >= 0)).map(key=>
            ({
                label: methods[key].label,
                value: key
            })),
        name: "default_method"
    },
    {
        "type": "color",
        "name": "default_foreground_color",
        "value": "#FFFFFF",
        "title": "Default foreground color"
    },
    {
        "type": "color",
        "name": "default_background_color",
        "value": "#000000",
        "title": "Default background color"
    },
    {
        "type": "color",
        "name": "default_link_color",
        "value": "#7FD7FF",
        "title": "Default link color"
    },
    {
        "type": "color",
        "name": "default_visited_color",
        "value": "#FFAFFF",
        "title": "Default visited link color"
    },
    {
        "type": "color",
        "name": "default_active_color",
        "value": "#FF0000",
        "title": "Default active link color"
    },
    {
        "type": "color",
        "name": "default_selection_color",
        "value": "#8080FF",
        "title": "Default selection color"
    }/*,
    {
        type: 'string',
        name: 'black_on_transparent_selectors',
        value: [
            'img[alt="inline_formula"]'
        ].join(', '),
        title: '"Black on transparent" elements selectors'
    }*/
];
preferences.forEach(pref => {
    if (!(pref.name in simple_prefs.prefs)) {
        simple_prefs.prefs[pref.name] = pref.value;
    }
});

const preferences_workers = [];

const built_in_configured = {
    'chrome://browser/content/browser.xul': '0',
    /*'chrome://browser/content/': '0', - there are iframes in about:preferences that points here, do not ignore it*/
    'chrome://browser/content/devtools/': '0', // Developer tools have good dark theme
    'chrome://devtools/content/': '0',
    //'about:addons': '4'
    'chrome://navigator/content/navigator.xul': '0', // SeaMonkey
};
built_in_configured[self.data.url('configure-for-current-tab-panel.html')] = '1';
built_in_configured[self.data.url('preferences.html')] = '1';

function get_merged_configured() {
    var result = {};
    for (let att in built_in_configured) {
        result[att] = built_in_configured[att];
    }
    for (let att in simplestorage.storage.configured) {
        result[att] = simplestorage.storage.configured[att];
    }
    for (let att in configured_private) {
        result[att] = configured_private[att];
    }
    return result
}
function get_method_for_url(url) {
    let method = 'unspecified';
    let merged_configured = get_merged_configured();
    url = url.replace(new RegExp('^https?://(?:www\\.)?'), '');
    let pure_domains = Object.keys(merged_configured).filter(key => (key.indexOf('/') < 0));
    let with_path = Object.keys(merged_configured).filter(key => (key.indexOf('/') >= 0));
    if (with_path.sort((a, b) => a.length < b.length).some(saved_url => {
            if (url.indexOf(saved_url) === 0) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {} // if .some() returns true => we found it!
    else if (pure_domains.sort((a, b) => a.length < b.length).some(saved_url => {
            let saved_arr = saved_url.split('.').reverse();
            let test_arr = url.split('/')[0].split('.').reverse();
            if (saved_arr.length < test_arr.length)
                return false;
            if (saved_arr.every((part, index) => (part === test_arr[index]))) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {}
    else
        method = methods[simple_prefs.prefs["default_method"]];
    return method;
}
function update_global_sheet(unload) {
    if (loaded_global_stylesheet && stylesheet_service.sheetRegistered(loaded_global_stylesheet, 'user'))
        stylesheet_service.unregisterSheet(loaded_global_stylesheet, 'user');
    if (!unload) {
        loaded_global_stylesheet = process_stylesheet(self.data.url('methods/global.css'), simple_prefs.prefs);
        stylesheet_service.loadAndRegisterSheet(loaded_global_stylesheet, 'user');
    }
}
function update_options() {
    gppmm.broadcastAsyncMessage('update_options', simple_prefs.prefs);
    update_global_sheet();
}
function settings_changed(data) {
    let { url, method } = data;
    if (!data.isPrivate) {
        if (method < 0) {
            delete simplestorage.storage.configured[url]
        } else {
            simplestorage.storage.configured[url] = method;
        }
    } else {
        if (method < 0) {
            delete configured_private[url]
        } else {
            configured_private[url] = method;
        }
    }
    gppmm.broadcastAsyncMessage('update_applied_methods');
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
    if (url_obj.hostname) {
        let tld = sdk_url.getTLD(url_str);
        let hostname_short = url_obj.hostname
            .replace(new RegExp('^www\\.'), '')
            .replace(new RegExp('\\.' + tld.split('.').join('\\.') + '$'), '');

        if (url_obj.hostname === tld) { // domain itself is top-level (eg. localhost)
            result_list.push(tld);
            preselect = tld;
            before_path = tld;
        } else {
            hostname_short.split('.').reverse().forEach((part, index, parts) => {
                let result = parts.slice(0, index + 1).reverse().join('.') + '.' + tld;
                result_list.push(result);
                preselect = result;
                before_path = result;
            });
        }
    } else {
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
function get_settings_init_params() {
    return {
        methods: methods,
        configured: get_merged_configured(),
        //TODO: pass url here:
        urls: generate_urls(),
        /* BAD NEWS: It seems that isPrivate(Tab) is broken on android! But isPrivate(nsIDOMWindow) works //TODO: test with android */
        isPrivate: isFennec ? isPrivate(getTargetWindow(tabs.activeTab)) : isPrivate(tabs.activeTab),
        isTouchscreen: ui_type === 'android'
    }
}

preferences.forEach(pref => {
    simple_prefs.on(pref.name, key => {
        preferences_workers.forEach(worker => {
            worker.port.emit('refresh', {
                name: key,
                value: simple_prefs.prefs[key]
            })
        });
        if (key === 'default_method')
            gppmm.broadcastAsyncMessage('update_applied_methods');
        else
            update_options();
    });
});
simple_prefs.on('open_addon_prefs', () => { tabs.open(self.data.url('preferences.html')) });

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
            simple_prefs.prefs[data.name] = data.value;
        });
        worker.port.on('settings-reset', name => {
            simple_prefs.prefs[name] = preferences.filter(p => (p.name === name))[0].value;
        });
        worker.port.emit('init', {
            isTouchscreen: ui_type === 'android',
            preferences: preferences.map(p => {
                let pref = {};
                for (let k in p) {
                    if (k === 'value') {
                        pref['value'] = simple_prefs.prefs[p.name];
                    } else {
                        pref[k] = p[k];
                    }
                }
                return pref;
            })
        });
    }
});

var ui = new UI({
    id: 'configure-for-current-tab',
    label: 'Dark background and light text',
    labelShort: 'Dark bg & light text',
    tooltip: 'Dark background and light text options for current web page',
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
ui.on('panel-show', () => ui.emit('init', get_settings_init_params()));
ui.on('panel-port-settings-changed', data => {
    ui.hide();
    settings_changed(data);
});
ui.on('panel-port-open-preferences', () => {
    ui.hide();
    // TODO: provide more options
    tabs.open(self.data.url('preferences.html'));
});

let fx_prefs = {
    'reader.color_scheme': 'dark',
    'devtools.theme': 'dark',
    'browser.display.use_system_colors': false,
    'browser.display.document_color_use': 1, // 'Override the colors specified by the page with my selections above' => 'Never'
    'browser.devedition.theme.enabled': true
};

exports.main = function(options, callbacks) {
    update_global_sheet();
    //TODO: watch for this options change and warn user
    Object.keys(fx_prefs).forEach(pref => about_config.set(pref, fx_prefs[pref]));
    console.log('main', options);

    gppmm.loadProcessScript('chrome://dark-background-light-text/content/process-script.js', true);
    gppmm.addMessageListener('query_method_for_url', msg => {
        msg.target.sendAsyncMessage('result_method_for_url', {
            method: get_method_for_url(msg.data.url).number,
            prefs: simple_prefs.prefs,
            index: msg.data.index
        });
    });
};

exports.onUnload = function(reason) {
    Object.keys(fx_prefs).forEach(pref => about_config.reset(pref));
    if (reason !== 'shutdown') { // no need to do heavy things on shutdown
        update_global_sheet(true);
        gppmm.broadcastAsyncMessage('unload_all');
        gppmm.removeDelayedProcessScript('chrome://dark-background-light-text/content/process-script.js');
    }
};

/*
* */

/* Added one more method of changing page colors
 * Added settings to choose default method of changing page colors
 * Added ability to choose method of changing page colors or disable it for certain pages
 */

/* Experimental support for Seamonkey, Palemoon and Desktop Firefox <=30
 * Added menu item to configure page settings in Firefox for Android
 */
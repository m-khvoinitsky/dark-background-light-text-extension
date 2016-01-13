//http://joyreactor.cc/post/2116903 - hover comments
// darkest text colors: #9DB8C7 (http://linz.by/)

const self = require('sdk/self');
const worker = require('./worker');
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
const { forEachNsIDOMWindow } = require('./utils');
const stylesheet_service = require('./stylesheet-service');
const { process_stylesheet } = require('./utils');
const about_config = require('sdk/preferences/service');

// methods. moved out of 'methods' object because of https://bugzilla.mozilla.org/show_bug.cgi?id=1195580
const { StylesheetProcessorMethod } = require('./methods/stylesheet-processor');
const { SimpleCSSMethod } = require('./methods/simple-css');
const { InvertMethod } = require('./methods/invert');

const isFennec = xul_app.is('Fennec');

/*console.log(xul_app);*/

var loaded_global_stylesheet;
const processedDocuments = new WeakMap();
const catched_docs = [];

if (!simplestorage.storage.configured)
    simplestorage.storage.configured = {};
const configured_private = {};
events.on("last-pb-context-exited", function (event) {
    for (var url in configured_private) {
        delete configured_private[url];
    }
}, true);

const methods = {
    '-1': {
        number: '-1',
        label: 'Default'
    },
    0: {
        number: '0',
        label: 'Disabled',
        executor: {
            load_into_window: () => {},
            unload_from_window: () => {},
            update_options: () => {}
        }
    },
    1: {
        number: '1',
        label: 'Stylesheet processor',
        executor: new StylesheetProcessorMethod()
    },
    2: {
        number: '2',
        label: 'Simple CSS',
        executor: new SimpleCSSMethod()
    },
    3: {
        number: '3',
        label: 'Invert',
        executor: new InvertMethod()
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
    //'about:addons': '4'
    'chrome://navigator/content/navigator.xul': '0', // SeaMonkey
};
built_in_configured[self.data.url('configure-for-current-tab-panel.html')] = '1';
built_in_configured[self.data.url('preferences.html')] = '1';

function get_merged_configured() {
    var result = {};
    for (var att in built_in_configured) {
        result[att] = built_in_configured[att];
    }
    for (var att in simplestorage.storage.configured) {
        result[att] = simplestorage.storage.configured[att];
    }
    for (var att in configured_private) {
        result[att] = configured_private[att];
    }
    return result
};
function get_method_for_url(url) {
    let method;
    let merged_configured = get_merged_configured();
    Object.keys(
        merged_configured
    ).sort((a, b) => a.length < b.length).every(
        function (saved_url, index, array) {
            if (url.indexOf(saved_url) == 0) {
                method = methods[merged_configured[saved_url]];
                return false
            }
            return true
        }
    );
    if (!method)
        method = methods[simple_prefs.prefs["default_method"]];
    return method;
};
function load_into_window(window) {
    console.log('new window', window.document.documentURI);
    if (processedDocuments.has(window.document)) {
        return;
    }
    let url = window.document.documentURI;

    // TODO: ignoring about:blank breaks some things, for example (some?) embedded tweets
    // need to decide what to do with them
    /*if (url === 'about:blank')
        return; */

    let method = get_method_for_url(url);

    processedDocuments.set(window.document, {method});
    // console.log('main load_into_window', url, window, window.document, window.document.styleSheets, method);

    if (method.executor)
        method.executor.load_into_window(window, simple_prefs.prefs);
    else
        console.log('executor not implemented');
};
var process_newdoc_event = isFennec ? function(event) {
    // (content|chrome)-document-global-created will contain window in subj
    // but document-element-inserted will contain document
    // so, get window for all

    // for some reason, getTargetWindow is very buggy on fennec, so, separate implementation for it.
    let window;
    if (event.subject.document) // window
        window = event.subject;
    if (event.subject.defaultView) // document
        window = event.subject.defaultView;
    if (window) {
        load_into_window(window);
    }
} : function(event) {
    let window = getTargetWindow(event.subject);
    if (window) {
        load_into_window(window);
    }
};
function update_global_sheet(unload) {
    if (loaded_global_stylesheet && stylesheet_service.sheetRegistered(loaded_global_stylesheet, 'user'))
        stylesheet_service.unregisterSheet(loaded_global_stylesheet, 'user');
    if (!unload) {
        loaded_global_stylesheet = process_stylesheet(self.data.url('methods/global.css'), simple_prefs.prefs);
        stylesheet_service.loadAndRegisterSheet(loaded_global_stylesheet, 'user');
    }
}
function update_options() {
    forEachNsIDOMWindow(window => {
        try {
            if (processedDocuments.has(window.document)) {
                processedDocuments.get(window.document).method.executor.update_options(window, simple_prefs.prefs);
            }
        } catch (e) {console.log(e, e.stack)}
    });
    update_global_sheet();
}
function update_applied_methods() {
    forEachNsIDOMWindow(window => {
        if (!(window.document))
            return;
        if (processedDocuments.has(window.document)) {
            let old_method = processedDocuments.get(window.document).method;
            let new_method = get_method_for_url(window.document.documentURI);
            if (old_method != new_method) {
                if (old_method.executor)
                    old_method.executor.unload_from_window(window);
                processedDocuments.delete(window.document);
                load_into_window(window);
            }
        } else {
            load_into_window(window);
        }
    })
};
function settings_changed(data) {
    var url = data["url"];
    var method = data["method"];
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
    update_applied_methods();
};
function generate_urls() {
    var url = getTargetWindow(tabs.activeTab).document.documentURI;
    var splitted = url.split('/');
    var result = new Array();
    if (splitted[0].indexOf(":") == (splitted[0].length - 1)) {
        result.push(splitted.slice(0, 3).join("/"));
        result.push(splitted.slice(0, 4).join("/"));
    }
    else {
        result.push(splitted.slice(0, 1).join("/"));
        result.push(splitted.slice(0, 2).join("/"));
    }
    result.push(url);
    var result_uniq = new Array();
    for (var i in result) {
        if (result_uniq.indexOf(result[i]) == -1) {
            result_uniq.push(result[i]);
        }
    }
    return result_uniq;
};
function get_settings_init_params() {
    return {
        methods: methods,
        configured: get_merged_configured(),
        urls: generate_urls(),
        /* BAD NEWS: It seems that isPrivate(Tab) is broken on android! But isPrivate(nsIDOMWindow) works */
        isPrivate: isPrivate(getTargetWindow(tabs.activeTab)),
        isTouchscreen: ui_type === 'android'
    }
};

events.on('content-document-global-created', process_newdoc_event, true);
events.on('chrome-document-global-created', process_newdoc_event, true);
events.on('document-element-inserted', process_newdoc_event, true);

preferences.forEach(pref => {
    simple_prefs.on(pref.name, key => {
        preferences_workers.forEach(worker => {
            worker.port.emit('refresh', {
                name: key,
                value: simple_prefs.prefs[key]
            })
        });
        if (key === 'default_method')
            update_applied_methods();
        else
            update_options();
    });
});
simple_prefs.on('open_addon_prefs', () => { tabs.open(self.data.url('preferences.html')) });
forEachNsIDOMWindow(load_into_window);

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
    label: 'Black background and white text',
    labelShort: 'Black bg & white text',
    tooltip: 'Black background and white text options for current web page',
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

exports.main = function(options, callbacks) {
    update_global_sheet();
    console.log('main', options);
};

exports.onUnload = function(reason) {
    if (reason !== 'shutdown') { // no need to do heavy things on shutdown
        forEachNsIDOMWindow(window => {
            if (processedDocuments.has(window.document)) {
                let { method } = processedDocuments.get(window.document);
                if (method && method.executor)
                    method.executor.unload_from_window(window);
            }
        });
        update_global_sheet(true);
    }
};
/*
const { ActionButton } = require("sdk/ui/button/action");
const testbutton = ActionButton({
    id: "my-button",
    label: "my button",
    icon: {
        "16": "./firefox-16.png",
        "32": "./firefox-32.png"
    },
    onClick: function(state) {
        for (let i in catched_docs) {
            let d = catched_docs[i];
            let was = false;
            forEachNsIDOMWindow(window => {
                if (window.document === d)
                    was = true;
            });
            if (!was)
                try {
                    console.log('not iterable', d, d.documentURI, getTargetWindow(d));
                } catch (e) { }
            else {
                try {
                    console.log('iterable', d, d.documentURI, getTargetWindow(d))
                } catch (e) {}
            }
            if (processedDocuments.has(d))
                console.log('processed: ', processedDocuments.get(d))
        }

        forEachNsIDOMWindow(window => {
            if (catched_docs.indexOf(window.document) < 0)
                console.log('not catched', window.document, window.document.documentURI, window);
            else
                console.log('catched', window.document, window.document.documentURI, window);
        });
    }
});*/

/*
* */

/* Added one more method of changing page colors
 * Added settings to choose default method of changing page colors
 * Added ability to choose method of changing page colors or disable it for certain pages
 */

/* Experimental support for Seamonkey, Palemoon and Desktop Firefox <=30
 * Added menu item to configure page settings in Firefox for Android
 */
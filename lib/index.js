var self = require('sdk/self');
try {
    var worker = require("sdk/deprecated/sync-worker.js");
} catch (e) {
    var worker = require("sdk/content/worker");
}
var lang_type = require('sdk/lang/type');
var attachTo = require("sdk/content/mod").attachTo;
var Style = require("sdk/stylesheet/style").Style;
var tabs = require("sdk/tabs");
var { setTimeout } = require("sdk/timers");

const button_type_unsupported = "Unsupported";
const button_type_togglebutton = "ToggleButton";
const button_type_android_nativewindow = "AndroidNativeWindow";
const button_type_old_xul_toolbarbutton = "XULToolbarbutton";
const BUTTON_ID = ['toolbarbutton', self.name, self.id].join('_').replace('@', '-');
var button_type = button_type_unsupported;

try {
    //  Recent versions of Desktop Firefox
    var { ToggleButton } = require('sdk/ui/button/toggle');
    var panels = require("sdk/panel");
    button_type = button_type_togglebutton;
    //throw Error("ONLY FOR DEBUG!!!");
}
catch (exception_var) {
    let { Cu } = require("chrome");
    Cu.import("resource://gre/modules/Services.jsm");
    var NativeWindow = Services.wm.getMostRecentWindow("navigator:browser").NativeWindow;
    if (NativeWindow)
        // Firefox for Android
        button_type = button_type_android_nativewindow;
    else
        // Seamonkey, Palemoon, Thunderbird(?) and old versions of Desktop Firefox,
        button_type = button_type_old_xul_toolbarbutton;
}

var isPrivate = require("sdk/private-browsing").isPrivate;

var prefs = require("sdk/simple-prefs").prefs;

var simplestorage = require("sdk/simple-storage");
var events = require("sdk/system/events");
const {getTargetWindow} = require('sdk/content/mod');
var stylesheet_utils = require("sdk/stylesheet/utils");

if (!simplestorage.storage.configured)
    simplestorage.storage.configured = {};
var configured_private = {};
events.on("last-pb-context-exited", function (event) {
    for (var url in configured_private) {
        delete configured_private[url];
    }
}, true);

var methods = {
    "-1": {
        "number": "-1",
        "label": "Default"
    },
    "0": {
        "number": "0",
        "label": "Disabled"
    },
    "1": {
        "number": "1",
        "label": "Simple CSS",
        "styles": ['methods/base.css', 'methods/simple-css.css']
    },
    "2": {
        "number": "2",
        "label": "JS mutation observer",
        "styles": ['methods/base.css'],
        "scripts": ['methods/js-mutation-observer.js']
    },
    "3": {
        "number": "3",
        "label": "Invert",
        "styles": ['methods/invert.css']
    },
    "4": {
        "number": "4",
        "label": 'Stylesheet generator',
        'styles': ['methods/stylesheet-generator.css', 'methods/base.css', 'methods/simple-css.css', 'methods/exp.css'],
        'privileged_scripts': ['modified_stylesheet_appender']
    }
};

var privileged_scripts = {
    modified_stylesheet_appender: require('./modified_stylesheet_appender.js').main
};

var built_in_configured = {
    'chrome://browser/content/devtools/': '0', // Developer tools have good dark theme

};

built_in_configured[self.data.url('configure-for-current-tab-panel.html')] = '0';

var get_merged_configured = function () {
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


var process_page = function (window, url) {
    if (!url)
        url = window.location.href;
    if (url.length == 0) {
        //console.log('url.length == 0');
        return;
    }
    //console.log('>>>>>>>>>attaching to ' + url);
    if (!(window.____BBG_PROCESSED)) {
        window.____BBG_PROCESSED = true;
        var method;

        var merged_configured = get_merged_configured();

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
            method = methods[prefs["default-blackout-method"]];

        if (method.scripts) {
            let w = worker.Worker({
                window: window,
                contentScriptFile: method.scripts.map(script => self.data.url(script))
            });
        }
        if (method.styles) {
            method.styles.forEach(function (style) {
                stylesheet_utils.loadSheet(window, self.data.url(style), 'user');
            });
        }
        if (method.privileged_scripts) {
            method.privileged_scripts.forEach(function (script) {
                window.setTimeout(privileged_scripts[script], 0, window);
                //privileged_scripts[script](window);
            })
        }
    } else {
        //console.log('ALREADY PROCESSED!!!');
    }
};
events.on('content-document-global-created', function (data) {
    process_page(data.subject);
}, true);
events.on('chrome-document-global-created', function (data) {
    process_page(data.subject);
}, true);
events.on('document-element-inserted', function (data) {
    let window;
    try {
        window = getTargetWindow(data.subject);
    } catch (e) {}
    if (window)
        process_page(window, data.subject.URL);
}, true);

for (let tab of tabs) {
    let window = getTargetWindow(tab);
    if (window)
        process_page(window);
}

var generate_urls = function () {
    var url = tabs.activeTab.url;
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

var settings_changed = function (data) {
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
};

var get_settings_init_params = function () {
    return {
        "methods": methods,
        "configured": get_merged_configured(),
        "urls": generate_urls(),
        "isPrivate": isPrivate(tabs.activeTab),
        "isTouchscreen": (button_type == button_type_android_nativewindow)
    }
};

switch (button_type) {
    case button_type_togglebutton:
    {
        //console.log('BUTT new firefox');
        var handleChange = function (state) {
            if (state.checked) {
                panel.show({
                    position: button
                });
                panel.port.emit('init', get_settings_init_params());
            }
        };

        var handleHide = function () {
            button.state('window', {checked: false});
        };
        var button = ToggleButton({
            id: "configure-for-current-tab-button",
            label: "Black background and white text",
            icon: {
                "16": "./icon16.png",
                "32": "./icon32.png",
                "64": "./icon64.png"
            },
            onChange: handleChange
        });
        var panel = panels.Panel({
            contentURL: self.data.url("configure-for-current-tab-panel.html"),
            onHide: handleHide,
            contentScriptFile: self.data.url("configure-for-current-tab-panel.js")
        });

        panel.port.on('settings-changed', function (data) {
            panel.hide();
            settings_changed(data);
            tabs.activeTab.reload();
        });
    }
        ;
        break;
    case button_type_old_xul_toolbarbutton:
    {
        //console.log('BUTT xul');

        var isAustralis = ("gCustomizeMode" in Services.wm.getMostRecentWindow("navigator:browser"));
        /*
        https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Toolbars/Creating_toolbar_buttons
        https://github.com/dgutov/bmreplace/blob/67ad019be480fc6b5d458dc886a2fb5364e92171/bootstrap.js#L27
        */

        var loadIntoWindow = function (window) {
            if (!window) return;
            let document = window.document;
            let toolbox = document.getElementById('navigator-toolbox');
            if (toolbox) { // navigator window
                // add to palette
                let button = document.createElement("toolbarbutton");
                button.setAttribute("id", BUTTON_ID);
                button.setAttribute('type', 'menu');// 'panel');
                button.setAttribute("label", "Black bg & White text");
                button.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
                button.setAttribute('orient', 'horizontal');
                button.setAttribute("tooltiptext", "Black background and white text options for current web page");
                button.style.listStyleImage = "url(" + self.data.url('icon24.png') + ")";
                let panel = document.createElement("panel");
                panel.setAttribute('type', 'arrow');
                panel.style.width = '320px';
                panel.style.height = '240px';
                let iframe = document.createElement('iframe');
                iframe.setAttribute("flex", 1);
                iframe.setAttribute("transparent", "transparent");
                iframe.setAttribute('src', self.data.url('configure-for-current-tab-panel.html'));
                panel.appendChild(iframe);
                let iframe_settings_worker;
                panel.addEventListener('popupshowing', function(data){
                    if (data.target === panel) {
                        if (!iframe.contentWindow.__worker_attached_) {
                            iframe_settings_worker = worker.Worker({
                                window: iframe.contentWindow,
                                contentScriptFile: self.data.url('configure-for-current-tab-panel.js')
                            });
                            iframe_settings_worker.port.on('settings-changed', function(data) {
                                panel.hidePopup();
                                settings_changed(data);
                                tabs.activeTab.reload();
                            });
                            iframe.contentWindow.__worker_attached_ = iframe_settings_worker;
                        }
                        iframe_settings_worker.port.emit('init', get_settings_init_params());
                        return true;
                    }
                });
                button.appendChild(panel);

                toolbox.palette.appendChild(button);
                // move to saved toolbar position
                let toolbar_id = simplestorage.storage.xul_maintoolbarbutton_toolbar_id;
                let next_item_id = simplestorage.storage.xul_maintoolbarbutton_next_item_id;
                if (lang_type.isNull(toolbar_id)) {
                    // user manually removed button from any toolbar, do not add it
                } else {
                    var nav_bar_id = isAustralis ? 'nav-bar-customization-target' : 'nav-bar';
                    // if toolbar_id is undefined ==> user has never changed toolbars after addon installation,
                    //     so, let's add button to default navigation toolbar
                    // else, just use saved toolbar
                    toolbar_id = lang_type.isUndefined(toolbar_id) ? nav_bar_id :
                        ((toolbar_id == 'nav-bar' && isAustralis) ? 'nav-bar-customization-target' : toolbar_id);
                    let toolbar = toolbar_id && document.getElementById(toolbar_id);
                    if (toolbar) {
                        let nextItem = document.getElementById(next_item_id);
                        toolbar.insertItem(BUTTON_ID, nextItem &&
                        nextItem.parentNode.id == toolbar_id &&
                        nextItem);

                        var style = Style({
                            source:
                                'toolbar[iconsize="small"] #BUTTON_ID \
                                { list-style-image: url("SML_PIC_URL") !important; }'
                                    .replace('BUTTON_ID', BUTTON_ID)
                                    .replace('SML_PIC_URL', self.data.url('icon16.png'))
                        });
                        attachTo(style, window);
                    }
                }
                window.addEventListener("aftercustomization", afterCustomize, false);
            }
        };

        var afterCustomize = function (e) {
            //console.log('aftexfrcustomization');
            let toolbox = e.target;
            let button = toolbox.parentNode.querySelector(['#', BUTTON_ID].join(''));
            let toolbar_id, next_item_id;
            if (button) {
                let parent = button.parentNode,
                    nextItem = button.nextSibling;
                if ((parent && (parent.localName == "toolbar" || (isAustralis && parent.localName == 'hbox')))) {
                    toolbar_id = parent.id;
                    next_item_id = nextItem && nextItem.id;
                }
            }
            if (lang_type.isUndefined(toolbar_id)) {
                toolbar_id = null;
                next_item_id = null;
            }
            simplestorage.storage.xul_maintoolbarbutton_toolbar_id = toolbar_id;
            simplestorage.storage.xul_maintoolbarbutton_next_item_id = next_item_id;
        };

        var windowWatcher = function (subject, topic) {
            if (topic === "domwindowopened") {
                runOnLoad(subject, loadIntoWindow);
            }
        };

        var eachWindow = function (callback) {
            let enumerator = Services.wm.getEnumerator("navigator:browser");
            while (enumerator.hasMoreElements()) {
                let win = enumerator.getNext();
                if (win.document.readyState === "complete") {
                    callback(win);
                } else {
                    runOnLoad(win, callback);
                }
            }
        };

        var runOnLoad = function (window, callback) {
            window.addEventListener("load", function () {
                window.removeEventListener("load", arguments.callee, false);
                callback(window);
            }, false);
        };

        var unloadFromWindow = function (window) {
            if (!window) return;
            let document = window.document;
            let button = document.getElementById(BUTTON_ID) ||
                document.getElementById("navigator-toolbox").palette.getElementById(BUTTON_ID);
            button && button.parentNode.removeChild(button);
            window.removeEventListener("aftercustomization", afterCustomize, false);
        };

        eachWindow(loadIntoWindow);
        Services.ww.registerNotification(windowWatcher);
    }
        ;
        break;
    case button_type_android_nativewindow:
    {;
        var button_type_android_nativewindow_menu_id = NativeWindow.menu.add({
            name: "Black bg & White text",
            icon: self.data.url('icon32.png'),
            callback: function () {
                let current_tab = tabs.activeTab;
                /* BAD NEWS: It seems that isPrivate(Tab) is broken on android! But isPrivate(nsIDOMWindow) works */
                let is_tab_private = isPrivate(getTargetWindow(current_tab));
                // broken isPrivate workaround
                let init_params = get_settings_init_params();
                init_params['isPrivate'] = is_tab_private;
                var settings_tab = tabs.open({
                    url: self.data.url('configure-for-current-tab-panel.html'),
                    isPrivate: is_tab_private,
                    onLoad: function(tab) {
                        let c_worker = worker.Worker({
                            window: getTargetWindow(tab),
                            contentScriptFile: self.data.url('configure-for-current-tab-panel.js')
                        });
                        /*let c_worker = tab.attach({
                            contentScriptFile: self.data.url('configure-for-current-tab-panel.js')
                        });*/

                        // TODO: move init and settings-changed strings to constants
                        c_worker.port.emit('init', init_params);
                        c_worker.port.on('settings-changed', function(data){
                            settings_changed(data);
                            current_tab.reload();
                            current_tab.activate();
                            tab.close();
                        });
                    }
                });
                /*NativeWindow.toast.show([
                    JSON.stringify(settings_tab.url),
                    JSON.stringify(is_tab_private ? 'PRIVATE' : 'NOT PRIVATE')
                ].join(' _ '), "short");*/
            }
        });
    }
        ;
        break;
}

exports.onUnload = function (reason) {
    if (button_type === button_type_old_xul_toolbarbutton) {
        Services.ww.unregisterNotification(windowWatcher);
        eachWindow(unloadFromWindow);
    }
    if (button_type === button_type_android_nativewindow) {
        NativeWindow.menu.remove(button_type_android_nativewindow_menu_id);
    }
};
/* * Added one more method of changing page colors
 * Added settings to choose default method of changing page colors
 * Added ability to choose method of changing page colors or disable it for certain pages
 */

/*
* Experimental support for Seamonkey, Palemoon and Desktop Firefox <=30
* Added menu item to configure page settings in Firefox for Android
* */
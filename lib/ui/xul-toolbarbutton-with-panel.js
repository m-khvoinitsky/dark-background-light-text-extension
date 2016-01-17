var { Class } = require('sdk/core/heritage');
const { BaseUI } = require('./base-ui');
let { Cu } = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var available = false;

available = true;
var { name:self_name, id:self_id, data:self_data } = require('../self');
/*
 https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Toolbars/Creating_toolbar_buttons
 https://github.com/dgutov/bmreplace/blob/67ad019be480fc6b5d458dc886a2fb5364e92171/bootstrap.js#L27
 */

if (!available) {
    exports.XULToolbarbuttonWithPanel = undefined;
} else {
    var { emit:event_emit } = require('sdk/event/core');
    var { storage } = require("sdk/simple-storage");
    var lang_type = require('sdk/lang/type');
    var { attachTo } = require("sdk/content/mod");
    var { Style } = require("sdk/stylesheet/style");
    var worker = require('sdk/content/worker');
    exports.XULToolbarbuttonWithPanel = Class({
        extends: BaseUI,
        initialize: function initialize(options) {
            BaseUI.prototype.initialize.call(this);
            this.options = options;
            this.toolbarbutton_id = [
                this.options.id, 
                'toolbarbutton', 
                self_name, 
                self_id
            ].join('_').replace('@', '-');

            this.isAustralis = ("gCustomizeMode" in Services.wm.getMostRecentWindow("navigator:browser"));
            this.loadIntoWindow = window => {
                if (!window) return;
                let document = window.document;
                let toolbox = document.getElementById('navigator-toolbox');
                if (toolbox) { // navigator window
                    // add to palette
                    let button = document.createElement("toolbarbutton");
                    button.setAttribute("id", this.toolbarbutton_id);
                    button.setAttribute('type', 'menu');// 'panel');
                    button.setAttribute("label", this.options.labelShort);
                    button.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
                    button.setAttribute('orient', 'horizontal');
                    button.setAttribute("tooltiptext", this.options.tooltip);
                    button.style.listStyleImage = "url(" + self_data.url(this.options.icon['24']) + ")";
                    this.panel = document.createElement("panel");
                    this.panel.setAttribute('type', 'arrow');
                    this.panel.style.width = '320px';
                    this.panel.style.height = '240px';
                    let iframe = document.createElement('iframe');
                    iframe.setAttribute("flex", 1);
                    iframe.setAttribute("transparent", "transparent");
                    iframe.setAttribute('src', options.contentURL);
                    this.panel.appendChild(iframe);
                    let iframe_settings_worker;
                    this.panel.addEventListener('popupshowing', data => {
                        if (data.target === this.panel) {
                            if (!iframe.contentWindow.__worker_attached_) {
                                iframe_settings_worker = worker.Worker({
                                    window: iframe.contentWindow,
                                    contentScriptFile: this.options.contentScriptFile
                                });
                                this.port = iframe_settings_worker.port;
                                this.process_subscribed_events();
                                iframe.contentWindow.__worker_attached_ = iframe_settings_worker;
                            }
                            event_emit(this, 'panel-show');
                            return true;
                        }
                    });
                    button.appendChild(this.panel);

                    toolbox.palette.appendChild(button);
                    // move to saved toolbar position
                    let toolbar_id = storage.xul_maintoolbarbutton_toolbar_id;
                    let next_item_id = storage.xul_maintoolbarbutton_next_item_id;
                    if (lang_type.isNull(toolbar_id)) {
                        // user manually removed button from any toolbar, do not add it
                    } else {
                        var nav_bar_id = this.isAustralis ? 'nav-bar-customization-target' : 'nav-bar';
                        // if toolbar_id is undefined ==> user has never changed toolbars after addon installation,
                        //     so, let's add button to default navigation toolbar
                        // else, just use saved toolbar
                        toolbar_id = lang_type.isUndefined(toolbar_id) ? nav_bar_id :
                            ((toolbar_id == 'nav-bar' && this.isAustralis) ? 'nav-bar-customization-target' : toolbar_id);
                        let toolbar = toolbar_id && document.getElementById(toolbar_id);
                        if (toolbar) {
                            let nextItem = document.getElementById(next_item_id);
                            toolbar.insertItem(this.toolbarbutton_id, nextItem &&
                                nextItem.parentNode.id == toolbar_id &&
                                nextItem);

                            var style = Style({
                                source:
                                    'toolbar[iconsize="small"] #toolbarbutton_id \
                                    { list-style-image: url("SML_PIC_URL") !important; }'
                                        .replace('toolbarbutton_id', this.toolbarbutton_id)
                                        .replace('SML_PIC_URL', self_data.url(this.options.icon['16']))
                            });
                            attachTo(style, window);
                        }
                    }
                    window.addEventListener("aftercustomization", this.afterCustomize, false);
                }
            };
            this.afterCustomize = event => {
                //console.log('aftexfrcustomization');
                let toolbox = event.target;
                let button = toolbox.parentNode.querySelector(['#', this.toolbarbutton_id].join(''));
                let toolbar_id, next_item_id;
                if (button) {
                    let parent = button.parentNode,
                        nextItem = button.nextSibling;
                    if ((parent && (parent.localName == "toolbar" || (this.isAustralis && parent.localName == 'hbox')))) {
                        toolbar_id = parent.id;
                        next_item_id = nextItem && nextItem.id;
                    }
                }
                if (lang_type.isUndefined(toolbar_id)) {
                    toolbar_id = null;
                    next_item_id = null;
                }
                storage.xul_maintoolbarbutton_toolbar_id = toolbar_id;
                storage.xul_maintoolbarbutton_next_item_id = next_item_id;
            };
            this.windowWatcher = (subject, topic) => {
                if (topic === "domwindowopened") {
                    this.runOnLoad(subject, this.loadIntoWindow);
                }
            };
            this.eachWindow = callback => {
                let enumerator = Services.wm.getEnumerator("navigator:browser");
                while (enumerator.hasMoreElements()) {
                    let win = enumerator.getNext();
                    if (win.document.readyState === "complete") {
                        callback(win);
                    } else {
                        this.runOnLoad(win, callback);
                    }
                }
            };
            this.runOnLoad = (window, callback) => {
                window.addEventListener("load", () => {
                    window.removeEventListener("load", arguments.callee, false);
                    callback(window);
                }, false);
            };
            this.unloadFromWindow = window => {
                if (!window) return;
                let document = window.document;
                let button = document.getElementById(this.toolbarbutton_id) ||
                    document.getElementById("navigator-toolbox").palette.getElementById(this.toolbarbutton_id);
                button && button.parentNode.removeChild(button);
                window.removeEventListener("aftercustomization", afterCustomize, false);
            };
            this.eachWindow(this.loadIntoWindow);
            Services.ww.registerNotification(this.windowWatcher);
        },
        hide: function hide() {
            this.panel.hidePopup();
        },
        unload: function unload() {
            Services.ww.unregisterNotification(this.windowWatcher);
            this.eachWindow(this.unloadFromWindow);
        }
    })
}

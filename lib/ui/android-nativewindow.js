const { Class } = require('sdk/core/heritage');
const { BaseUI } = require('./base-ui');

var available = false;

const { Cu } = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
const { NativeWindow } = Services.wm.getMostRecentWindow("navigator:browser");
if (NativeWindow)
    available = true;

if (!available) {
    exports.AndroidNativeWindow = undefined;
} else {
    const { data:self_data } = require('../self');
    const tabs = require("sdk/tabs");
    const { emit:event_emit } = require('sdk/event/core');
    const { getTargetWindow } = require('sdk/content/mod');
    const { isPrivate } = require("sdk/private-browsing");
    Cu.import("resource://gre/modules/PageActions.jsm");
    let show_toast;
    let toast_duration;
    Cu.import("resource://gre/modules/Snackbars.jsm");
    show_toast = Snackbars.show;
    toast_duration = {
        short: Snackbars.SHORT,
        long: Snackbars.LONG
    };
    exports.AndroidNativeWindow = Class({
        extends: BaseUI,
        initialize: function initialize(options) {
            BaseUI.prototype.initialize.call(this);
            this.options = options;
            this.menu_id = NativeWindow.menu.add({
                name: this.options.labelShort,
                icon: self_data.url(this.options.icon['32']),
                callback: () => {
                    this.hide();
                    event_emit(this, 'panel-show');
                }
            });
            this.page_action_id = PageActions.add({
                title: this.options.label,
                icon: self_data.url(this.options.icon['64']),
                clickCallback: () => {
                    this.hide();
                    event_emit(this, 'panel-show');
                },
                longClickCallback: () => {
                    show_toast(this.options.tooltip, 'short');
                }
            })
        },
        emit: function emit(type, message) {
            if (!this.panel_tab) {
                this.panel_tab = tabs.open({
                    url: this.options.contentURL,
                    isPrivate: isPrivate(getTargetWindow(tabs.activeTab)),
                    onLoad: tab => {
                        /*let c_worker = worker.Worker({
                            window: getTargetWindow(tab),
                            contentScriptFile: this.options.contentScriptFile
                        });*/
                        this.port = tab.attach({
                            contentScript: 'self.port.emit(\'ui_worker_ready\');',
                            contentScriptFile: this.options.contentScriptFile
                        }).port;

                        // workaround for 'TypeError: this.sandbox is undefined' caused by some race condition possibly inside 'sdk/content/worker-child.js'
                        this.port.on('ui_worker_ready', () => {
                            this.port.emit(type, message);
                            this.process_subscribed_events();
                        });
                    }
                });
            } else {
                BaseUI.prototype.emit.call(this, type, message);
            }
        },
        hide: function hide() {
            try {
                this.panel_tab.close();
            } catch (e) {}
            this.panel_tab = undefined;
        },
        unload: function unload() {
            NativeWindow.menu.remove(this.menu_id);
            PageActions.remove(this.page_action_id);
        }
    })
}

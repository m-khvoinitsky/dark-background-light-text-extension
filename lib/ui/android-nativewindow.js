var { Class } = require('sdk/core/heritage');
const { BaseUI } = require('./base-ui');

var available = false;

let { Cu } = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
let { NativeWindow } = Services.wm.getMostRecentWindow("navigator:browser");
if (NativeWindow)
    available = true;

if (!available) {
    exports.AndroidNativeWindow = undefined;
} else {
    var { data:self_data } = require('../self');
    var tabs = require("sdk/tabs");
    var { emit:event_emit } = require('sdk/event/core');
    let worker = require('sdk/content/worker');
    const { getTargetWindow } = require('sdk/content/mod');
    const { isPrivate } = require("sdk/private-browsing");
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
            })
        },
        emit: function emit(type, message) {
            if (!this.panel_tab) {
                this.panel_tab = tabs.open({
                    url: this.options.contentURL,
                    isPrivate: isPrivate(getTargetWindow(tabs.activeTab)),
                    onLoad: tab => {
                        let c_worker = worker.Worker({
                            window: getTargetWindow(tab),
                            contentScriptFile: this.options.contentScriptFile
                        });
                        /*let c_worker = tab.attach({
                         contentScriptFile: this.options.contentScriptFile
                         });*/
                        this.port = c_worker.port;
                        c_worker.port.emit(type, message);
                        this.process_subscribed_events();
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
        }
    })
}

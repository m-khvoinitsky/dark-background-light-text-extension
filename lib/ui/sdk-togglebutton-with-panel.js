var { Class } = require('sdk/core/heritage');
const { BaseUI } = require('./base-ui');
var { emit:event_emit } = require('sdk/event/core');

var available = false;

try {
    //  Desktop Firefox 30 and above
    var { ToggleButton } = require('sdk/ui/button/toggle');
    var { Panel } = require("sdk/panel");
    let { platformVersion, versionInRange } = require('sdk/system/xul-app');
    //TODO: check if version check is needed
    if (versionInRange(platformVersion, '30', '9999'))
        available = true;
}
catch (e) {}

if (!available) {
    exports.SDKToggleButtonWithPanel = undefined;
} else {
    exports.SDKToggleButtonWithPanel = Class({
        extends: BaseUI,
        initialize: function initialize(options) {
            BaseUI.prototype.initialize.call(this);
            this.button_onChange = state => {
                if (state.checked) {
                    this.panel.show({
                        position: this.togglebutton
                    });
                    event_emit(this, 'panel-show');
                }
            };
            this.panel_onHide = () => {
                this.togglebutton.state('window', {checked: false});
            };
            this.panel = Panel({
                contentURL: options.contentURL,
                onHide: this.panel_onHide,
                contentScript: 'window.addEventListener("resize", function(){if (document.body.clientWidth != 0) self.port.emit("window-size-ready", document.body.clientHeight)}, false);',
                contentScriptFile: options.contentScriptFile /*,
                height: options.height*/
            });
            this.port = this.panel.port;
            this.port.on('window-size-ready', height => {
                this.panel.resize(this.panel.width, height + 20); //TODO: replace hardcoded '20' with something calculated
            });
            this.togglebutton = ToggleButton({
                id: options.id + '-button',
                label: options.label,
                icon: options.icon,
                onChange: this.button_onChange
            });
        },
        hide: function hide() {
            this.panel.hide();
        }
    })
}

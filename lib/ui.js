exports.UI = (() => {
    let { SDKToggleButtonWithPanel } = require('./ui/sdk-togglebutton-with-panel');
    if (SDKToggleButtonWithPanel) {
        //  Recent versions of Desktop Firefox
        exports.ui_type = 'sdk';
        return SDKToggleButtonWithPanel;
    }
    let { AndroidNativeWindow } = require('./ui/android-nativewindow');
    if (AndroidNativeWindow) {
        // Firefox for Android
        exports.ui_type = 'android';
        return AndroidNativeWindow;
    }
})();

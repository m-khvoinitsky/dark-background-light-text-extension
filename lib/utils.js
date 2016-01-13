var { Cu, Ci } = require("chrome");
var { getTargetWindow } = require('sdk/content/mod');
Cu.import("resource://gre/modules/Services.jsm");
var isFennec = require('sdk/system/xul-app').is('Fennec');
var tabs = require("sdk/tabs");
var self = require('sdk/self');
var base64 = require("sdk/base64");

var count_char_in_string = function(char, str) {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
exports.count_char_in_string = count_char_in_string;

var split_background_image = function(value, separator) {
    // TODO: handle more complex cases
    if (!separator)
        separator = ',';
    let result = [];
    let current = [];
    let depth = 0;
    let splitted = value.split(separator);
    for (let i = 0; i < splitted.length; i++) {
        current.push(splitted[i].trim());
        depth += count_char_in_string('(', splitted[i]);
        depth -= count_char_in_string(')', splitted[i]);
        if (depth === 0) {
            result.push(current.join(separator));
            current = [];
        }
    }
    return result;
};
exports.split_background_image = split_background_image;

var intersect = function(set1, set2) {
    return set1.some(
            set1_cur => set2.some(
                    set2_cur => (set2_cur.indexOf(set1_cur) >= 0 || set1_cur.indexOf(set2_cur) >= 0)
            )
    )
};
exports.intersect = intersect;

function processNsIDocShell(docshell, processed_windows, callback) {
    if (docshell.getDocShellEnumerator) {
        let enumerator = docshell.getDocShellEnumerator(0x7FFFFFFF, 1); //TODO: remove magic numbers
        while (enumerator.hasMoreElements()) {
            let el = enumerator.getNext();
            if (el !== docshell) {
                let docShell = el.QueryInterface(Ci.nsIDocShell);
                let window = getTargetWindow(docShell.contentViewer.DOMDocument);
                if (!processed_windows.has(window)) {
                    callback(window);
                    processed_windows.add(window);
                }
                processNsIDocShell(docShell, processed_windows, callback);
            }
        }
    }
};
/*var { ActionButton } = require("sdk/ui/button/action");
let { Cc, Ci } = require('chrome');
const appShellService = Cc['@mozilla.org/appshell/appShellService;1'].
                        getService(Ci.nsIAppShellService);        */

let { getContentFrame } = require('sdk/panel/utils');
function forEachNsIDOMWindow(callback) {
    let processed_windows = new WeakSet();
    if (isFennec) {
        for (let tab of tabs) {
            try {
                let window = getTargetWindow(tab);
                if (window && !processed_windows.has(window)) {
                    callback(window);
                    processed_windows.add(window);
                }
                processNsIDocShell(window.document.docShell, processed_windows, callback);
            } catch (e) {
                console.log(e);
                // TODO: investigate why tab is undefined sometimes
            }
        }
    } else {
        let enumerator = Services.wm.getEnumerator(null);
        while (enumerator.hasMoreElements()) {
            let rootWindow = enumerator.getNext();
            if (!processed_windows.has(rootWindow)) {
                callback(rootWindow);
                processed_windows.add(rootWindow);
            }
            let mainPopupSet = rootWindow.document.querySelector('#mainPopupSet');
            if (mainPopupSet) {
                Array.prototype.forEach.call(mainPopupSet.childNodes, node => {
                    if (node.backgroundFrame) {
                        try {
                            let { docShell } = getContentFrame(node);
                            let window = getTargetWindow(docShell.contentViewer.DOMDocument);
                            callback(window);
                            processed_windows.add(window);
                            processNsIDocShell(docShell);
                        } catch (e) {console.log('SHITSHITSHIT')}
                    }
                })
            }
            processNsIDocShell(rootWindow.document.docShell, processed_windows, callback);
        }
        //processNsIDocShell(appShellService.hiddenDOMWindow.document.docShell, processed_windows, callback);
    }
};

exports.forEachNsIDOMWindow = forEachNsIDOMWindow;

exports.process_stylesheet = function process_stylesheet(sheet, options) {
    let sheet_text = self.data.load(sheet);
    for (let key in options) {
        sheet_text = sheet_text.replace(
            new RegExp('{' + key + '}', 'g'),
            options[key]
        )
    }
    return 'data:text/css;charset=utf-8;base64,' + base64.encode(sheet_text)
};
const isFennec = require('sdk/system/xul-app').ID === '{aa3c5121-dab2-40e2-81ca-7ea25febc110}';
const tabs = isFennec ? require("sdk/tabs") : null; // sdk/tabs is required only on fennec
const { Cu, Ci } = require("chrome");
const { getTargetWindow } = require('sdk/content/mod');
Cu.import("resource://gre/modules/Services.jsm");

// const { getContentFrame } = require('sdk/panel/utils');
// sdk/panel/utils crashes inside process script. copied implementation here
const getContentFrame = panel =>
    ((panel.state === "open") || (panel.state === "showing")) ?
        panel.firstChild :
        panel.backgroundFrame;

function processNsIDocShell(docshell, processed_windows, callback) {
    if (docshell.getDocShellEnumerator) {
        let enumerator = docshell.getDocShellEnumerator(
            docshell.typeAll,
            docshell.ENUMERATE_FORWARDS
        );
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
}

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
        if (!enumerator.hasMoreElements()) // content process //TODO: write it more clear and test Services.ww.getWindowEnumerator() with fennec.
            enumerator = Services.ww.getWindowEnumerator();
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
                            //TODO: get rid of getTargetWindow
                            let window = getTargetWindow(docShell.contentViewer.DOMDocument);
                            callback(window);
                            processed_windows.add(window);
                            processNsIDocShell(docShell);
                        } catch (e) {
                            console.error(e)
                        }
                    }
                })
            }
            processNsIDocShell(rootWindow.document.docShell, processed_windows, callback);
        }
        //processNsIDocShell(appShellService.hiddenDOMWindow.document.docShell, processed_windows, callback);
    }
}

exports.forEachNsIDOMWindow = forEachNsIDOMWindow;

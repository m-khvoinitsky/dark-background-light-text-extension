"use strict";
const { console } = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {});
const { require } = Components.utils.import('resource://gre/modules/commonjs/toolkit/require.js', {});
const { setTimeout } = require('sdk/timers');

const events = require("sdk/system/events");
const isFennec = require('sdk/system/xul-app').is('Fennec');
const { forEachNsIDOMWindow } = require('./foreach_nsIDOMWindow.js');

const methods = require('./methods/methods').get_methods_with_executors();

let windows_queue = {};
let window_index = 0;

let message_listeners = {
    result_method_for_url: data => {
        let { method: method_n, prefs, index: c_win_index } = data.data;
        let window = windows_queue[c_win_index];
        delete windows_queue[c_win_index];
        let load_method = true;
        if ('_black_background_' in window.document) {
            let current_method_n = window.document._black_background_;
            if (current_method_n !== method_n) {
                methods[current_method_n].executor.unload_from_window(window);
                delete window.document['_black_background_'];
            } else
                load_method = false;
        }
        if (load_method) {
            window.document._black_background_ = method_n;
            let method = methods[method_n];
            if (method.executor)
                method.executor.load_into_window(window, prefs);
        }
    },
    update_applied_methods: () => {
        forEachNsIDOMWindow(window => {
            if (!(window.document))
                return;
            load_into_window(window);
        })
    },
    update_options: msg => {
        forEachNsIDOMWindow(window => {
            //TODO: in index.js here was exception handler. does it needed here?
            if ('_black_background_' in window.document) {
                methods[window.document._black_background_].executor.update_options(window, msg.data);
            }
        });
    },
    unload_all: () => {
        for (let message in message_listeners)
            removeMessageListener(message, message_listeners[message]);
        for (let event of newdoc_events)
            events.off(event, process_newdoc_event);

        forEachNsIDOMWindow(window => {
            if ('_black_background_' in window.document) {
                let current_method_n = window.document._black_background_;
                if (current_method_n >= 0)
                    methods[current_method_n].executor.unload_from_window(window);
                delete window.document['_black_background_'];
            }
        });
    }
};

function load_into_window(window, no_defer) {
    //TODO: may be window may be considered as not ready if documentURI === about:blank but location.href is empty. need to check
    if (window.document.documentURI === 'about:blank' && !no_defer) {
        setTimeout(() => { load_into_window(window, true) }, 1000);
        return;
    }
    //TODO: there should be some better way to filter certain data: pages
    if ((window.document.documentURI.indexOf('data:') === 0) && window.document.documentURI.indexOf('chrome://devtools/content/sourceeditor/') >= 0)
        return; // devtools-based source editor, its dark theme is good, uses CSS var()

    if (!(Object.keys(windows_queue).some(key => (windows_queue.hasOwnProperty(key) && windows_queue[key] === window)))) {
        windows_queue[window_index] = window;
        sendAsyncMessage(
            'query_method_for_url',
            {
                url: window.document.documentURI,
                index: window_index
            }
        );
        window_index++;
    }
}
function process_newdoc_event(event) {
    // (content|chrome)-document-global-created will contain window in subject
    // but document-element-inserted will contain document
    // so, get window for all

    let window;
    if (event.subject.document) // window
        window = event.subject;
    if (event.subject.defaultView) // document
        window = event.subject.defaultView;
    if (window)
        load_into_window(window);
    //TODO:
    /*else
        console.log('NOT A WINDOW?', event);*/
}

const newdoc_events = [
    'content-document-global-created',
    'chrome-document-global-created',
    'document-element-inserted'
];

function init() {
    for (let message in message_listeners)
        addMessageListener(message, message_listeners[message]);
    for (let event of newdoc_events)
        events.on(event, process_newdoc_event, true);
    forEachNsIDOMWindow(load_into_window);
}

init();

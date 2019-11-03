let browser_info = ('getBrowserInfo' in browser.runtime) ?
    browser.runtime.getBrowserInfo() :
    new Promise((resolve, reject) => {
        // TODO
    });
let platform_info = ('getPlatformInfo' in browser.runtime) ?
    browser.runtime.getPlatformInfo() :
    new Promise((resolve, reject) => {
        // TODO
    });

let is_gecko; // TODO: deprecated
try {
    browser.runtime.getBrowserInfo();
    is_gecko = true;
} catch (e) {
    is_gecko = false;
}

async function broadcast_message(msg) {
    for (let tab of await browser.tabs.query({})) {
        browser.tabs.sendMessage(tab.id, msg);
    }
}
const configured_private = {};
const configured_tabs = {};
browser.tabs.onRemoved.addListener(async (tabId) => {
    try {
        if (Object.keys(configured_private).length > 0) {
            for (let tab of await browser.tabs.query({})) {
                if (tab.incognito)
                    return;
            }
            for (let url of Object.keys(configured_private))
                delete configured_private[url];
            await broadcast_message({action: 'configured_private_changed', value: configured_private});
        }
        if (configured_tabs.hasOwnProperty(tabId))
            delete configured_tabs[tabId];
    } catch (e) {console.error(e);}
});

async function process_stylesheet(sheet, is_top_level_frame) {
    let options = await get_prefs();
    let is_dark_background = relative_luminance(parseCSSColor(options.default_background_color)) < relative_luminance(parseCSSColor(options.default_foreground_color));
    let if_toplevel_start = is_top_level_frame ? '' : '/*';
    let if_toplevel_end = is_top_level_frame ? '' : '*/';
    let if_dark_background_start = is_dark_background ? '' : '/*';
    let if_dark_background_end = is_dark_background ? '' : '*/';
    let if_light_background_start = is_dark_background ? '/*' : '';
    let if_light_background_end = is_dark_background ? '*/' : '';

    let render_params = Object.assign(
        {},
        options,
        {
            if_dark_background_start,
            if_dark_background_end,
            if_light_background_start,
            if_light_background_end,
            if_toplevel_start,
            if_toplevel_end,
        }
    );
    let sheet_text = await (await fetch(browser.extension.getURL(sheet))).text();
    for (let key in render_params) {
        sheet_text = sheet_text.replace(
            new RegExp(`{${key}}`, 'g'),
            (render_params[key].indexOf && render_params[key].indexOf('#') === 0) ? render_params[key].slice(1) : render_params[key]
        );
    }
    return sheet_text;
}

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        if (!message.action) {
            console.error('bad message!', message);
            return;
        }
        switch (message.action) {
            case 'content_script_loaded': {
                let loaded_stylesheets = [];
                if (message.loaded_stylesheets && is_gecko /* TODO: chromium workaround */ ) {
                    message.loaded_stylesheets.forEach(args => browser.tabs.removeCSS(sender.tab.id, args));
                }
                for (let sheet of message.method.stylesheets) {
                    let args = {
                        frameId: sender.frameId,
                        cssOrigin: 'user',
                        code: await process_stylesheet(sheet, (sender.frameId === 0)),
                        runAt: 'document_start',
                    };
                    if (sender.tab) {
                        // regular tab
                        try {
                            browser.tabs.insertCSS(sender.tab.id, args);
                        } catch (e) {
                            delete args['cssOrigin'];
                            browser.tabs.insertCSS(sender.tab.id, args);
                        }
                        loaded_stylesheets.push(args);
                    }
                }
                return loaded_stylesheets;
            }
            case 'query_base_style':
                return await process_stylesheet('methods/base.css', true);
            case 'get_configured_private':
                return configured_private;
            case 'set_configured_private':
                if (message.value === null)
                    delete configured_private[message.key];
                else
                    configured_private[message.key] = message.value;
                await broadcast_message({action: 'configured_private_changed', value: configured_private});
                break;
            case 'get_my_tab_configuration':
                message.tab_id = sender.tab.id;
                // falls through
            case 'get_tab_configuration':
                if (configured_tabs.hasOwnProperty(message.tab_id))
                    return configured_tabs[message.tab_id];
                else
                    return false;
            case 'set_configured_tab':
                if (message.value === null) {
                    if (configured_tabs.hasOwnProperty(message.key))
                        delete configured_tabs[message.key];
                } else
                    configured_tabs[message.key] = message.value;
                await broadcast_message({action: 'configured_tabs_changed', value: configured_tabs});
                break;
            case 'open_options_page':
                // while runtime.openOptionsPage() works from browserAction page script, due to bug 1414917 it behaves unintuitive on Fennec so here is a workaround
                if ((await platform_info).os === 'android')
                    setTimeout(() => browser.runtime.openOptionsPage(), 500);
                else
                    browser.runtime.openOptionsPage();
                break;
            case 'is_commands_update_available':
                return browser.hasOwnProperty('commands') && browser.commands.hasOwnProperty('update');
            default:
                console.log('bad message 2!');
                break;
        }
    } catch (e) { console.exception(e); }
});


on_prefs_change(changes => {
    for (let pref in changes) {
        if (pref === 'global_toggle_hotkey') {
            try {
                browser.commands.update({
                    name: 'toggle-global',
                    shortcut: changes[pref]['newValue'],
                })
            } catch (e) {
                set_pref('global_toggle_hotkey', changes[pref]['oldValue']);
            }
        }
    }
});

if (browser.hasOwnProperty('commands')) {
    if (browser.commands.hasOwnProperty('update'))
        get_prefs(preferences.filter(pref => pref.type === 'hotkey').map(pref => pref.name)).then(values => {
            for (let k in values)
                try {
                    browser.commands.update({
                        name: k,
                        shortcut: values[k],
                    })
                } catch (e) {console.exception(e);}
        });

    browser.commands.onCommand.addListener(async (name) => {
        try {
            let current_tab;
            switch (name) {
                case 'global_toggle_hotkey':
                    set_pref('enabled', !(await get_prefs('enabled')));
                    break;
                case 'tab_toggle_hotkey':
                    current_tab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
                    if (configured_tabs.hasOwnProperty(current_tab.id))
                        delete configured_tabs[current_tab.id];
                    else
                        configured_tabs[current_tab.id] = '0';
                    await broadcast_message({action: 'configured_tabs_changed', value: configured_tabs});
                    break;
                default:
                    console.error('bad command');
                    break;
            }
        } catch (e) { console.exception(e); }
    });
}

browser.browserSettings.overrideDocumentColors.set({value: 'never'}).catch(error => console.error(error));

(async function() {
    if ((await platform_info).os === 'android') {
        browser.tabs.onUpdated.addListener(tab_id => {
            browser.pageAction.show(tab_id);
        });
        browser.tabs.onCreated.addListener(tab => {
            browser.pageAction.show(tab.id);
        });
        (await browser.tabs.query({})).forEach(tab => {
            browser.pageAction.show(tab.id);
        });
    }
})().catch(rejection => console.error(rejection));

browser.runtime.onInstalled.addListener(details => {
    if (details.reason === 'update' && details.previousVersion && details.previousVersion.indexOf('0.5.') === 0) {
        browser.tabs.create({
            active: true,
            url: '/ui/webextensions-release-notes.html',
        });
    }
});

browser.webRequest.onHeadersReceived.addListener(
    details => {
        try {
            let headers = details.responseHeaders.map(header => {
                if (header.name.toLowerCase() === 'content-security-policy') {
                    let new_values = header.value.split(',').map(value => {
                        let directives = {};
                        for (let directive of value.split(';').map(d => d.trim()).filter(d => d.length > 0)) {
                            let parts = directive.split(' ').map(p => p.trim()).filter(p => p.length > 0);
                            let name = parts.shift();
                            directives[name] = parts;
                        }

                        if (directives.hasOwnProperty('style-src')) {
                            if (directives['style-src'].includes('data:'))
                                return value;
                            else
                                directives['style-src'].push('data:');
                        } else if (directives.hasOwnProperty('default-src')) {
                            if (directives['default-src'].includes('data:'))
                                return value;
                            else if (directives['default-src'].length === 1 && directives['default-src'][0] === "'none'")
                                directives['style-src'] = [ 'data:' ];
                            else {
                                directives['style-src'] = directives['default-src'].slice();
                                directives['style-src'].push('data:');
                            }
                        } else
                            return value;

                        return Object.keys(directives).map(k => `${k} ${directives[k].join(' ')}`).join('; ');
                    });
                    return {
                        name: header.name,
                        value: new_values.join(' , '),
                    };
                } else
                    return header;
            });

            return {
                responseHeaders: headers,
            };
        } catch (e) {
            console.error(e);
            return {};
        }
    },
    {
        urls: ['<all_urls>'],
        types: ['main_frame'],
    },
    [
        'blocking',
        'responseHeaders',
    ],
);

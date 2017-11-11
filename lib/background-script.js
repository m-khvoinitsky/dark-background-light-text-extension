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
browser.tabs.onRemoved.addListener(async () => {
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
            case 'open_options_page':
                // while runtime.openOptionsPage() works from browserAction page script, due to bug 1414917 it behaves unintuitive on Fennec so here is a workaround
                if ((await platform_info).os === 'android')
                    setTimeout(() => browser.runtime.openOptionsPage(), 500);
                else
                    browser.runtime.openOptionsPage();
                break;
            default:
                console.log('bad message 2!');
                break;
        }
    } catch (e) { console.exception(e); }
});

function are_arrays_equal(a1, a2) {
    if (a1.length !== a2.length)
        return false;
    return a1.every((element, index) => element === a2[index]);
}

const bad_browser_settings = 'bad_browser_settings';

browser.notifications.onClicked.addListener(notification_id => {
    if (notification_id !== bad_browser_settings)
        return;
    browser.tabs.create({
        active: true,
        url: '/ui/bad_browser_settings.html',
    });
});

async function verify_browser_settings() {
    try {
        if (!(await browser.windows.getLastFocused()).focused)
            return;

        // we need two testing colors just in case if user actually set their background color to our testing one (unlikely but still)
        let is_correct = ['rgba(255, 0, 0, 1)', 'rgba(0, 255, 0, 1)'].every(test_css_color => {
            let body = document.querySelector('body');
            let test_element = document.createElement('div');
            test_element.style.setProperty('background-color', test_css_color, 'important');
            body.appendChild(test_element);
            let actual_color = window.getComputedStyle(test_element).getPropertyValue('background-color');
            body.removeChild(test_element);
            return are_arrays_equal(parseCSSColor(test_css_color), parseCSSColor(actual_color));
        });
        if (
            !is_correct &&
            // check if there is already opened help page
            (await browser.tabs.query({url: browser.extension.getURL('/ui/bad_browser_settings.html')})).length === 0
        ) {
            browser.notifications.create(bad_browser_settings, {
                type: 'basic',
                iconUrl: browser.extension.getURL('icons/icon64.png'),
                title: `${browser.runtime.getManifest().name} warning`,
                message: `Invalid ${(await browser_info).name} settings detected! Please, click this notification to find out how to fix this.`,
            });
        }
    } catch (e) {console.error(e);}
}

(async function() {
    if ((await browser_info).vendor === 'Mozilla' && (await platform_info).os !== 'android') {
        verify_browser_settings();
        setInterval(verify_browser_settings, 5000);
    }
})().catch(rejection => console.error(rejection));

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
    if (
        details.reason === 'update' &&
        (
            (details.previousVersion && details.previousVersion.indexOf('0.5.') === 0) ||
            (!details.previousVersion) /*TODO: remove this in the next version*/
        )
    ) {
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
                    let policy = new Policy(header.value);
                    if (policy.get('style-src') !== '') {
                        policy.add('style-src', 'data:');
                    } else if (policy.get('default-src') !== '') {
                        policy.set('style-src', policy.get('default-src'));
                        policy.add('style-src', 'data:');
                    } else
                        return header;
                    return {
                        name: header.name,
                        value: policy.toString(),
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

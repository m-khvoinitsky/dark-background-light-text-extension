
const configured_private = {};
//TODO: this does not work!!!
browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    console.log('tabs.onRemoved');
    try {
        console.log(await browser.tabs.query({incognito: true}));
    } catch (e) {console.log(e)}
});

async function process_stylesheet(sheet, is_top_level_frame) {
    let options = await browser.storage.local.get(prefs_keys_with_defaults);
    let important_for_toplevel = is_top_level_frame ? '!important' : '';
    let is_dark_background = relative_luminance(parseCSSColor(options.default_background_color)) < relative_luminance(parseCSSColor(options.default_foreground_color));
    let if_dark_background_start = is_dark_background ? '' : '/*';
    let if_dark_background_end = is_dark_background ? '' : '*/';
    let if_light_background_start = is_dark_background ? '/*' : '';
    let if_light_background_end = is_dark_background ? '*/' : '';

    let render_params = Object.assign(
        {},
        options,
        {
            important_for_toplevel,
            if_dark_background_start,
            if_dark_background_end,
            if_light_background_start,
            if_light_background_end,
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
        console.log(['got message!', message.action, message, sender, sendResponse]);
        if (!message.action) {
            console.log('bad message!');
            return;
        }
        switch (message.action) {
            case 'content_script_loaded':
                (async function () {
                    for (let sheet of message.method.stylesheets) {
                        let args = {
                            frameId: sender.frameId,
                            cssOrigin: 'user',
                            code: await process_stylesheet(sheet, (sender.frameId === 0)),
                            runAt: 'document_start',
                        };
                        //TODO: cssOrigin doesn't work in chrome
                        /* if (chromium)
                            delete args[cssOrigin];
                        */
                        if (sender.tab) {
                            // regular tab
                            browser.tabs.insertCSS(sender.tab.id, args);
                        } else {
                            // probably our panel
                            console.log('Panel?!');
                            console.log(sender);
                        }
                    }
                })().catch(error => console.error(error));
                break;
            case 'query_base_style':
                return await process_stylesheet('methods/base.css', true);
            case 'get_configured_private':
                return configured_private;
            case 'set_configured_private':
                if (message.value !== null)
                    delete configured_private[message.key];
                else
                    configured_private[message.key] = message.value;
                browser.runtime.sendMessage({action: 'configured_private_changed', value: configured_private});
                break;
            default:
                console.log('bad message 2!');
                break;
        }
    } catch (e) { console.exception(e); }
});

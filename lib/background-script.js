let is_gecko;
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
                    if (!is_gecko)
                        delete args['cssOrigin'];
                    if (sender.tab) {
                        // regular tab
                        browser.tabs.insertCSS(sender.tab.id, args);
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
            default:
                console.log('bad message 2!');
                break;
        }
    } catch (e) { console.exception(e); }
});

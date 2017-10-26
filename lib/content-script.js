(async function() {
    let method = await get_method_for_url(window.document.documentURI);
    browser.runtime.sendMessage({
        action: 'content_script_loaded',
        url: window.document.documentURI,
        method: method,
    });

    let options = await browser.storage.local.get(prefs_keys_with_defaults);
    if (method.number === '1') {
        let processor = new StylesheetColorProcessor(window, options);
        processor.load_into_window();
    }
})().catch(rejection => console.error(rejection));

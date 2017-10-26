console.log('SOME SHIT!!!!');
async function do_it() {
    let method = await browser.runtime.sendMessage({'action': 'query_method_for_url', url: window.document.documentURI});
    let prefs_keys_with_defaults = await browser.runtime.sendMessage({action: 'get_prefs_keys_with_defaults'});
    let options = await browser.storage.local.get(prefs_keys_with_defaults);
    if (method.number === '1') {
        let processor = new StylesheetColorProcessor(window, options);
        processor.load_into_window();
    }
}
do_it().catch(rejection => console.error(rejection));

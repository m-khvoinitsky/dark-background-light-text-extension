let current_method;
let stylesheet_color_processor;
let loaded_stylesheets;

async function do_it(changes) {
    try {
        let new_method = await get_method_for_url(window.document.documentURI);
        if (
            !current_method ||
            new_method.number !== current_method.number ||
            Object.keys(changes).some(key => key.indexOf('_color') >= 0) // TODO: better condition
        ) {
            let loaded_stylesheets_promise = browser.runtime.sendMessage({
                action: 'content_script_loaded',
                url: window.document.documentURI,
                method: new_method,
                loaded_stylesheets,
            });
            if (stylesheet_color_processor) {
                stylesheet_color_processor.unload_from_window();
                stylesheet_color_processor = undefined;
            }
            if (new_method.number === '1') {
                stylesheet_color_processor = new StylesheetColorProcessor(window, await get_prefs());
                stylesheet_color_processor.load_into_window();
            }
            loaded_stylesheets = await loaded_stylesheets_promise;
        }
        current_method = new_method;
    } catch (e) {console.error(e);}
}

on_prefs_change(do_it);
do_it();

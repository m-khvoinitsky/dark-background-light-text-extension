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
browser.runtime.onMessage.addListener(
    msg => (msg.action === 'configured_private_changed' || msg.action === 'configured_tabs_changed') && do_it({})
);

const marker_class_prefix = 'dark-background-light-text-';
const selector_class_map = {
    'html > body > div#outerContainer > div#mainContainer > div#viewerContainer > div#viewer.pdfViewer': 'is-pdf-viewer',
    'html > head > link[href*="TopLevelImageDocument.css"]': 'is-top-level-image-document',
};

function set_marker_classes(event) {
    let document = event.target;
    for (let selector in selector_class_map)
        if (document.querySelector(selector))
            document.documentElement.classList.toggle(`${marker_class_prefix}${selector_class_map[selector]}`, true);
}

if (window.document.readyState === 'loading')
    window.document.addEventListener('DOMContentLoaded', set_marker_classes);
else
    set_marker_classes({target: window.document});

// TODO: proper unloading
// for (let selector in selector_class_map)
//     window.document.documentElement.classList.toggle(`${marker_class_prefix}${selector_class_map[selector]}`, false);

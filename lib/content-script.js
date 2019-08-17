const protocol_and_www = new RegExp('^(?:(?:https?)|(?:ftp))://(?:www\\.)?');
async function get_method_for_url(url) {
    //TODO: merge somehow part of this code with generate_urls()
    let method = 'unspecified';
    let prefs = await browser.storage.local.get(prefs_keys_with_defaults);
    if (prefs.enabled) {
        let tab_configuration = await browser.runtime.sendMessage({action: 'get_my_tab_configuration'});
        if (tab_configuration !== false)
            return methods[tab_configuration];
        let merged_configured = await get_merged_configured();
        if (url.search(protocol_and_www) >= 0) {
            url = url.replace(protocol_and_www, '');
            // dirty removing of portnumber from url
            //TODO: do not remove it but handle properly
            let colon = url.indexOf(':');
            let origin_end = url.indexOf('/');
            if (origin_end === -1) origin_end = url.length;
            if (colon < origin_end && url.substring(colon + 1, origin_end).search(/^(\d)+$/) === 0)
                url = url.substr(0, colon) + url.substr(origin_end);
        }
        let pure_domains = Object.keys(merged_configured).filter(key => (key.indexOf('/') < 0));
        let with_path = Object.keys(merged_configured).filter(key => (key.indexOf('/') >= 0));
        if (with_path.sort((a, b) => a.length < b.length).some(saved_url => {
            if (url.indexOf(saved_url) === 0) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {
        } // if .some() returns true => we found it!
        else if (pure_domains.sort((a, b) => a.length < b.length).some(saved_url => {
            let saved_arr = saved_url.split('.').reverse();
            let test_arr = url.split('/')[0].split('.').reverse();
            if (saved_arr.length > test_arr.length)
                return false;
            if (saved_arr.every((part, index) => (part === test_arr[index]))) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {
        }
        else
            method = methods[prefs.default_method];
        return method;
    } else
        return methods[0];
}

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

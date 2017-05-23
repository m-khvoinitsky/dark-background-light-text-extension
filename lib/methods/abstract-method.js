const stylesheet_utils = require('sdk/stylesheet/utils');
const self = require('sdk/self');
const base64 = require('sdk/base64');

const marker_class_prefix = 'dark-background-light-text-';
const selector_class_map = {
    'html > body > div#outerContainer > div#mainContainer > div#viewerContainer > div#viewer.pdfViewer': 'is-pdf-viewer',
};

function process_stylesheet(sheet, options) {
    let sheet_text = self.data.load(sheet);
    for (let key in options) {
        sheet_text = sheet_text.replace(
            new RegExp('{' + key + '}', 'g'),
            (options[key].indexOf && options[key].indexOf('#') === 0) ? options[key].slice(1) : options[key]
        )
    }
    return 'data:text/css;charset=utf-8;base64,' + base64.encode(sheet_text)
}
function set_marker_classes(event) {
    let document = event.target;
    for (let selector in selector_class_map)
        if (document.querySelector(selector))
            document.documentElement.classList.toggle(`${marker_class_prefix}${selector_class_map[selector]}`, true);
}

class AbstractMethod {
    constructor() {
        this.documents = new WeakMap();
        this.stylesheets = [];
    }
    load_into_window(window, options) {
        if (!window || !window.document)
            return;
        if (this.documents.has(window.document))
            return;

        let loaded_stylesheets = this.load_stylesheets(window, options);

        this.documents.set(
            window.document,
            {
                loaded_stylesheets: loaded_stylesheets
            }
        );

        if (window.document.readyState === 'loading')
            window.document.addEventListener('DOMContentLoaded', set_marker_classes);
        else
            set_marker_classes({target: window.document});

        return true;
    }
    unload_from_window(window, options) {
        if (!window || !window.document)
            return;
        if (!this.documents.has(window.document))
            return;

        this.unload_stylesheets(window);

        for (let selector in selector_class_map)
            window.document.documentElement.classList.toggle(`${marker_class_prefix}${selector_class_map[selector]}`, false);

        this.documents.delete(window.document);
    }
    update_options(window, options) {
        this.unload_from_window(window, options);
        this.load_into_window(window, options);
    }
    load_stylesheets(window, options) {
        let important_for_toplevel = (window.top === window.self) ? '!important' : '';

        let processed_sheets = this.stylesheets.map(
            sheet => process_stylesheet(sheet, Object.assign({}, options, {
                important_for_toplevel
            }))
        );
        processed_sheets.forEach(
                sheet => stylesheet_utils.loadSheet(window, sheet, 'user')
        );
        return processed_sheets;
    }
    unload_stylesheets(window) {
        if (!window || !window.document)
            return;
        if (!this.documents.has(window.document))
            return;
        let stored_data = this.documents.get(window.document);
        if (!stored_data || !stored_data.loaded_stylesheets)
            return;
        stored_data.loaded_stylesheets.forEach(
                sheet => stylesheet_utils.removeSheet(window, sheet, 'user')
        )
    }
}

exports.process_stylesheet = process_stylesheet;
exports.AbstractMethod = AbstractMethod;

const { Class } = require('sdk/core/heritage');
const stylesheet_utils = require('sdk/stylesheet/utils');
const self = require('../self');
const base64 = require('sdk/base64');

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

const AbstractMethod = Class({
    initialize: function initialize() {
        this.documents = new WeakMap();
        this.stylesheets = [];
    },
    load_into_window: function load_into_window(window, options) {
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
        return true;
    },
    unload_from_window: function unload_from_window(window, options) {
        if (!window || !window.document)
            return;
        if (!this.documents.has(window.document))
            return;

        this.unload_stylesheets(window);

        this.documents.delete(window.document);
    },
    update_options: function update_options(window, options) {
        this.unload_from_window(window, options);
        this.load_into_window(window, options);
    },
    load_stylesheets: function load_stylesheets(window, options) {
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
    },
    unload_stylesheets: function unload_stylesheets(window) {
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
});

exports.process_stylesheet = process_stylesheet;
exports.AbstractMethod = AbstractMethod;

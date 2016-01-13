var { Class } = require('sdk/core/heritage');
var stylesheet_utils = require("sdk/stylesheet/utils");
const { process_stylesheet } = require('../utils');

var AbstractMethod = Class({
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
        let processed_sheets = this.stylesheets.map(
            sheet => process_stylesheet(sheet, options)
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

exports.AbstractMethod = AbstractMethod;
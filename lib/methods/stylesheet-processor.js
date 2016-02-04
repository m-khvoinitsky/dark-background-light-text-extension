var { Class } = require('sdk/core/heritage');
var { AbstractMethod } = require('./abstract-method');
var { StylesheetColorProcessor } = require('./stylesheet-color-processor');
var self = require('../self');


var StylesheetProcessorMethod = Class({
    extends: AbstractMethod,
    initialize: function initialize() {
        AbstractMethod.prototype.initialize.call(this);
        this.stylesheets.push(self.data.url('methods/base.css'));
        this.stylesheets.push(self.data.url('methods/stylesheet-processor.css'));
    },
    load_into_window: function load_into_window(window, options) {
        if (AbstractMethod.prototype.load_into_window.call(this, window, options)) {
            var processor = new StylesheetColorProcessor(window, options);
            processor.load_into_window();
            this.documents.get(window.document)['stylesheet_color_processor'] = processor;
        }
    },
    unload_from_window: function unload_from_window(window, options) {
        if (this.documents.has(window.document)) {
            this.documents.get(window.document)['stylesheet_color_processor'].unload_from_window();
        }
        AbstractMethod.prototype.unload_from_window.call(this, window, options);
    }
});

exports.StylesheetProcessorMethod = StylesheetProcessorMethod;
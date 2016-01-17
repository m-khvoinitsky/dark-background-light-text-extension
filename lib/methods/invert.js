var { Class } = require('sdk/core/heritage');
var { AbstractMethod } = require('./abstract-method');
var self = require('../self');

var InvertMethod = Class({
    extends: AbstractMethod,
    initialize: function initialize() {
        AbstractMethod.prototype.initialize.call(this);
        this.stylesheets.push(self.data.url('methods/invert.css'));
    },
    update_options: function update_options() {
        // doing nothing because this method does not use any options
    }
});

exports.InvertMethod = InvertMethod;
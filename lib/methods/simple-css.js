var { Class } = require('sdk/core/heritage');
var { AbstractMethod } = require('./abstract-method');
var self = require('../self');

var SimpleCSSMethod = Class({
    extends: AbstractMethod,
    initialize: function initialize() {
        AbstractMethod.prototype.initialize.call(this);
        this.stylesheets.push(self.data.url('methods/base.css'));
        this.stylesheets.push(self.data.url('methods/simple-css.css'));
    }
});

exports.SimpleCSSMethod = SimpleCSSMethod;
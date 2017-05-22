var { AbstractMethod } = require('./abstract-method');
var self = require('sdk/self');

class InvertMethod extends AbstractMethod {
    constructor() {
        super();
        this.stylesheets.push(self.data.url('methods/invert.css'));
    }
    update_options() {
        // doing nothing because this method does not use any options
    }
}

exports.InvertMethod = InvertMethod;
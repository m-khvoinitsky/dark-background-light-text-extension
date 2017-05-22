var { AbstractMethod } = require('./abstract-method');
var self = require('sdk/self');

class SimpleCSSMethod extends AbstractMethod {
    constructor() {
        super();
        this.stylesheets.push(self.data.url('methods/base.css'));
        this.stylesheets.push(self.data.url('methods/simple-css.css'));
    }
}

exports.SimpleCSSMethod = SimpleCSSMethod;
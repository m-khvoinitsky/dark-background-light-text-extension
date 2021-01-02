import {
    methods as methods_bare,
} from './methods';
import {
    MethodsMetadataWithStylesheets,
} from '../common/types';
import * as base from './stylesheets/base';
import * as invert from './stylesheets/invert';
import * as simple_css from './stylesheets/simple-css';
import * as stylesheet_processor from './stylesheets/stylesheet-processor';

// TODO: less hardcode, use names from modules
for (let key in methods_bare) {
    for (let i = 0; i < methods_bare[key].stylesheets.length; i++) {
        switch (methods_bare[key].stylesheets[i].name) {
            case 'base':
                methods_bare[key].stylesheets[i] = base;
                break;
            case 'invert':
                methods_bare[key].stylesheets[i] = invert;
                break;
            case 'simple-css':
                methods_bare[key].stylesheets[i] = simple_css;
                break;
            case 'stylesheet-processor':
                methods_bare[key].stylesheets[i] = stylesheet_processor;
                break;
            default:
                throw Error(`Unknown stylesheet name: ${methods_bare[key].stylesheets[i].name}`)
        }
    }
}
let methods = methods_bare as MethodsMetadataWithStylesheets;

export { methods };

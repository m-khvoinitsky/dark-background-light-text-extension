const { StylesheetProcessorMethod } = require('./stylesheet-processor');
const { SimpleCSSMethod } = require('./simple-css');
const { InvertMethod } = require('./invert');

const methods = {
    '-1': {
        label: 'Default'
    },
    0: {
        label: 'Disabled'
    },
    1: {
        label: 'Stylesheet processor',
        executor_class: StylesheetProcessorMethod
    },
    2: {
        label: 'Simple CSS',
        executor_class: SimpleCSSMethod
    },
    3: {
        label: 'Invert',
        executor_class: InvertMethod,
        affects_iframes: true
    }
};

function get_methods(with_executors) {
    let ret_methods = {};
    Object.keys(methods).forEach(k => {
        ret_methods[k] = {
            label: methods[k].label,
            number: k,
            affects_iframes: !!methods[k].affects_iframes,
            executor: with_executors ? (
                'executor_class' in methods[k] ? new (methods[k].executor_class)() : (
                    k === '0' ? {
                        load_into_window: () => {},
                        unload_from_window: () => {},
                        update_options: () => {}
                    } : null
                )
            ) : null
        }
    });
    return ret_methods;
}
exports.get_methods = () => get_methods(false);
exports.get_methods_with_executors = () => get_methods(true);
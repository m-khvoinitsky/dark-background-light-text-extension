/* exported methods */
const methods = (() => {
    const methods = {
        '-1': {
            label: 'Default',
        },
        0: {
            label: 'Disabled',
            affects_iframes: true,
        },
        1: {
            label: 'Stylesheet processor',    /* simple-css will be removed as soon as StylesheetColorProcessor do its work — this prevents bright flickering */
            stylesheets: ['methods/base.css', 'methods/simple-css.css', 'methods/stylesheet-processor.css'],
            executor: typeof StylesheetColorProcessor !== 'undefined' ? StylesheetColorProcessor : null,
        },
        2: {
            label: 'Simple CSS',
            stylesheets: ['methods/base.css', 'methods/simple-css.css'],
        },
        3: {
            label: 'Invert',
            stylesheets: ['methods/invert.css'],
            executor: typeof InvertMethod !== 'undefined' ? InvertMethod : null,
            affects_iframes: true,
        },
    };
    let ret_methods = {};
    Object.keys(methods).forEach(k => {
        ret_methods[k] = {
            label: methods[k].label,
            number: k,
            affects_iframes: !!methods[k].affects_iframes,
            stylesheets: methods[k].stylesheets ? methods[k].stylesheets : [],
            executor: methods[k].executor ? methods[k].executor : null,
        };
    });
    return ret_methods;
})();
/* exported preferences */
const preferences = [
    {
        type: 'bool',
        name: 'enabled',
        value: true,
        title: 'Enabled',
    },
    {
        type: 'hotkey',
        name: 'global_toggle_hotkey',
        value: 'Ctrl+Shift+D',
        title: 'Toggle "Enabled" hotkey',
        available: Object.prototype.hasOwnProperty.call(browser, 'tabs') ? Promise.resolve(Object.prototype.hasOwnProperty.call(browser, 'commands') && Object.prototype.hasOwnProperty.call(browser.commands, 'update')) : browser.runtime.sendMessage({action: 'is_commands_update_available'}),
    },
    {
        type: 'hotkey',
        name: 'tab_toggle_hotkey',
        value: 'F2',
        title: 'Toggle enabled for current tab hotkey',
        available: Object.prototype.hasOwnProperty.call(browser, 'tabs') ? Promise.resolve(Object.prototype.hasOwnProperty.call(browser, 'commands') && Object.prototype.hasOwnProperty.call(browser.commands, 'update')) : browser.runtime.sendMessage({action: 'is_commands_update_available'}),
    },
    {
        title: 'Default method of changing page colors',
        value: 1,
        type: 'menulist',
        options: Object.keys(methods).filter(key=>(parseInt(key) >= 0)).map(key=>
            ({
                label: methods[key].label,
                value: key,
            })),
        name: 'default_method',
    },
    {
        type: 'color',
        name: 'default_foreground_color',
        value: '#ffffff',
        title: 'Default foreground color',
    },
    {
        type: 'color',
        name: 'default_background_color',
        value: '#000000',
        title: 'Default background color',
    },
    {
        type: 'color',
        name: 'default_link_color',
        value: '#7fd7ff',
        title: 'Default link color',
    },
    {
        type: 'color',
        name: 'default_visited_color',
        value: '#ffafff',
        title: 'Default visited link color',
    },
    {
        type: 'color',
        name: 'default_active_color',
        value: '#ff0000',
        title: 'Default active link color',
    },
    {
        type: 'color',
        name: 'default_selection_color',
        value: '#8080ff',
        title: 'Default selection color',
    },
    {
        type: 'bool',
        name: 'do_not_set_overrideDocumentColors_to_never',
        value: false,
        title: 'Do not set "Override Document Colors" to "never" (not recommended)',
    },
    {
        type: 'configured_pages',
        name: 'configured_pages',
        value: {},
        title: 'configured_pages',
    },
];
/* exported prefs_keys_with_defaults */
const prefs_keys_with_defaults = (() => {
    let result = {};
    preferences.forEach(pref => { result[pref.name] = pref.value; });
    return result;
})();

/* exported get_prefs */
async function get_prefs(prefs) {
    let query = {};
    let is_single = false;
    if (Array.isArray(prefs)) {
        query = {};
        for (let key of prefs)
            query[key] = prefs_keys_with_defaults[key];
    } else if (Object.prototype.toString.call(prefs) === '[object String]') {
        query = {[prefs]: prefs_keys_with_defaults[prefs]};
        is_single = true;
    } else if (prefs === undefined || prefs === null) {
        query = prefs_keys_with_defaults;
    } else
        throw 'get_prefs parameter has unsupported type';
    let ret_data = await browser.storage.local.get(query);
    return is_single ? ret_data[prefs] : ret_data;
}

/* exported set_pref */
function set_pref(pref, value) {
    if (prefs_keys_with_defaults[pref] === value)
        return browser.storage.local.remove(pref);
    else
        return browser.storage.local.set({[pref]: value});
}

/* exported on_prefs_change */
function on_prefs_change(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local')
            throw 'unsupported';
        for (let pref in changes) {
            // if option has been removed, it means that it's value has been set to default
            if (!changes[pref].hasOwnProperty('newValue'))
                changes[pref]['newValue'] = prefs_keys_with_defaults[pref];
        }
        callback(changes);
    });
}

async function get_merged_configured() {
    let local_storage_p = browser.storage.local.get({configured_pages: {}});
    let configured_private_data = typeof configured_private !== 'undefined' ? configured_private : await browser.runtime.sendMessage({action: 'get_configured_private'});
    return Object.assign(
        {},
        (await local_storage_p).configured_pages,
        configured_private_data,
        // built_in_configured,
    );
}

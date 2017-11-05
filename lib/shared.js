/* exported methods */
const methods = (() => {
    const methods = {
        '-1': {
            label: 'Default',
        },
        0: {
            label: 'Disabled',
        },
        1: {
            label: 'Stylesheet processor',
            stylesheets: ['methods/base.css', 'methods/stylesheet-processor.css'],
            script: 'TBD.js',
        },
        2: {
            label: 'Simple CSS',
            stylesheets: ['methods/base.css', 'methods/simple-css.css'],
        },
        3: {
            label: 'Invert',
            stylesheets: ['methods/invert.css'],
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
            script: methods[k].script ? methods[k].script : null,
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
    let configured_private_p = browser.runtime.sendMessage({action: 'get_configured_private'});
    return Object.assign(
        {},
        (await local_storage_p).configured_pages,
        await configured_private_p,
        // built_in_configured,
    );
}
async function generate_urls(url_str) {
    let url_obj = new window.URL(url_str);

    let result_list = [];
    let preselect;

    let before_path;
    if (['http:', 'https:', 'ftp:'].indexOf(url_obj.protocol) >= 0) {
        let hostname_splitted = url_obj.hostname.split('.');
        let tld = hostname_splitted[hostname_splitted.length - 1]; //TODO: sdk_url.getTLD(url_str);
        let hostname_short = url_obj.hostname
            .replace(new RegExp('^www\\.'), '');
        if (tld) {
            hostname_short = hostname_short
                .replace(new RegExp(`\\.${tld.split('.').join('\\.')}$`), '');
        } // 'else' is most likely bare IP  TODO: it used to be with sdk_url.getTLD

        if (url_obj.hostname === tld) { // domain itself is top-level (eg. localhost)
            result_list.push(tld);
            preselect = tld;
            before_path = tld;
        } else {
            hostname_short.split('.').reverse().forEach((part, index, parts) => {
                let result = parts.slice(0, index + 1).reverse().join('.') + (!!tld ? ('.' + tld) : '');
                result_list.push(result);
                preselect = result;
                before_path = result;
            });
        }
        if (url_obj.port) { /* //TODO:
            let result = before_path + ':' + url_obj.port;
            result_list.push(result);
            preselect = result;
            before_path = result; */
        }
    } else {
        if (url_obj.protocol !== url_obj.origin) {
            result_list.push(url_obj.origin);
            preselect = url_obj.origin;
        }
        before_path = url_obj.origin;
    }

    let path_starts_with_slash = false;
    url_obj.pathname.split('/').forEach((part, index, parts) => {
        if (part.length === 0 && index === 0) {
            // if path starts with '/'
            path_starts_with_slash = true;
            return;
        }
        if (part.length === 0 && index === 1)
            return; // path is only '/'
        let result = path_starts_with_slash ?
            [before_path].concat( parts.slice(1, index + 1) ).join('/') :
            before_path + parts.slice(0, index + 1).join('/');
        result_list.push(result);
        if (!(preselect))
            preselect = result;
    });

    let merged = await get_merged_configured();
    result_list.forEach(url => {
        if (url in merged)
            preselect = url;
    });

    return { list: result_list, preselect };
}
const protocol_and_www = new RegExp('^(?:(?:https?)|(?:ftp))://(?:www\\.)?');
async function get_method_for_url(url) {
    //TODO: merge somehow part of this code with generate_urls()
    let method = 'unspecified';
    let prefs = await browser.storage.local.get(prefs_keys_with_defaults);
    if (prefs.enabled) {
        let merged_configured = await get_merged_configured();
        if (url.search(protocol_and_www) >= 0) {
            url = url.replace(protocol_and_www, '');
            // dirty removing of portnumber from url
            //TODO: do not remove it but handle properly
            let colon = url.indexOf(':');
            let origin_end = url.indexOf('/');
            if (origin_end === -1) origin_end = url.length;
            if (colon < origin_end && url.substring(colon + 1, origin_end).search(/^(\d)+$/) === 0)
                url = url.substr(0, colon) + url.substr(origin_end);
        }
        let pure_domains = Object.keys(merged_configured).filter(key => (key.indexOf('/') < 0));
        let with_path = Object.keys(merged_configured).filter(key => (key.indexOf('/') >= 0));
        if (with_path.sort((a, b) => a.length < b.length).some(saved_url => {
            if (url.indexOf(saved_url) === 0) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {
        } // if .some() returns true => we found it!
        else if (pure_domains.sort((a, b) => a.length < b.length).some(saved_url => {
            let saved_arr = saved_url.split('.').reverse();
            let test_arr = url.split('/')[0].split('.').reverse();
            if (saved_arr.length > test_arr.length)
                return false;
            if (saved_arr.every((part, index) => (part === test_arr[index]))) {
                method = methods[merged_configured[saved_url]];
                return true;
            }
        })) {
        }
        else
            method = methods[prefs.default_method];
        return method;
    } else
        return methods[0];
}

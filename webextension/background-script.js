let preferences;
let prefs_keys_with_defaults;

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

function set_pref(pref, value) {
    if (prefs_keys_with_defaults[pref] === value)
        return browser.storage.local.remove(pref);
    else
        return browser.storage.local.set({[pref]: value});
}
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local')
        throw 'unsupported';
    for (let pref in changes) {
        // if option has been removed, it means that it's value has been set to default
        if (!changes[pref].hasOwnProperty('newValue'))
            changes[pref]['newValue'] = prefs_keys_with_defaults[pref];
    }
    browser.runtime.sendMessage({
        action: 'preferences_change',
        changes
    });
});

let port = browser.runtime.connect();

port.onMessage.addListener(message => {
    switch (message.action) {
        case 'get_prefs':
            get_prefs(message.prefs).then(
                response => port.postMessage({id: message.id, response}),
                rejection => port.postMessage({id: message.id, rejection})
            );
            break;
        case 'set_pref':
            set_pref(message.pref, message.value).then(
                res => port.postMessage({id: message.id, response: undefined}),
                rejection => port.postMessage({id: message.id, rejection})
            );
            break;
        case 'initial_data':
            preferences = message.preferences;
            prefs_keys_with_defaults = message.prefs_keys_with_defaults;
            port.postMessage({id: message.id, response: undefined});
            break;
    }
});

declare var { browser }: typeof import('webextension-polyfill-ts');
import type { Storage } from 'webextension-polyfill-ts'
import type { MethodMetadata, Preference, PrefsType, ConfiguredPages, MethodIndex } from './types'
declare var { StylesheetColorProcessor }: typeof import('../methods/stylesheet-color-processor')
declare var { InvertMethod }: typeof import('../methods/invert')

export const methods: { [key: string /* MethodIndex */]: MethodMetadata } = {
    '-1': {
        number: '-1',
        label: 'Default',
        stylesheets: [],
        executor: null,
        affects_iframes: false,
    },
    0: {
        number: '0',
        label: 'Disabled',
        stylesheets: [],
        executor: null,
        affects_iframes: true,
    },
    1: {
        number: '1',
        label: 'Stylesheet processor',    /* simple-css will be removed as soon as StylesheetColorProcessor do its work — this prevents bright flickering */
        stylesheets: ['methods/base.css', 'methods/simple-css.css', 'methods/stylesheet-processor.css'],
        affects_iframes: false,
        executor: typeof StylesheetColorProcessor !== 'undefined' ? StylesheetColorProcessor : null,
    },
    2: {
        number: '2',
        label: 'Simple CSS',
        stylesheets: ['methods/base.css', 'methods/simple-css.css'],
        executor: null,
        affects_iframes: false,
    },
    3: {
        number: '3',
        label: 'Invert',
        stylesheets: ['methods/invert.css'],
        executor: typeof InvertMethod !== 'undefined' ? InvertMethod : null,
        affects_iframes: true,
    },
}
Object.entries(methods).forEach(([key, value]) => console.assert(key === value['number'], `bad method index, ${key} !== ${value['number']}`));

export const preferences: Preference[] = [
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

interface PrefsWithValues {
    [key: string]: PrefsType
}
export const prefs_keys_with_defaults = ((): PrefsWithValues => {
    let result: PrefsWithValues = {};
    preferences.forEach(pref => { result[pref.name] = pref.value; });
    return result;
})();

export function get_prefs(prefs?: string[]): Promise<PrefsWithValues>;
export function get_prefs(prefs: 'enabled'): Promise<boolean>;
export function get_prefs(prefs: 'configured_pages'): Promise<ConfiguredPages>;
export function get_prefs(prefs: 'default_method'): Promise<MethodIndex>;
export function get_prefs(prefs: 'do_not_set_overrideDocumentColors_to_never'): Promise<boolean>;
export function get_prefs(prefs: string): Promise<PrefsType>;
export async function get_prefs(prefs?: string | string[]): Promise<PrefsType | PrefsWithValues> {
    let query: PrefsWithValues = {};
    let is_single = false;
    if (Array.isArray(prefs)) {
        query = {};
        for (let key of prefs)
            query[key] = prefs_keys_with_defaults[key];
    } else if (Object.prototype.toString.call(prefs) === '[object String]') {
        query = {[prefs as string]: prefs_keys_with_defaults[prefs as string]};
        is_single = true;
    } else if (prefs === undefined || prefs === null) {
        query = prefs_keys_with_defaults;
    } else
        throw 'get_prefs parameter has unsupported type';
    let ret_data = await browser.storage.local.get(query);
    return is_single ? ret_data[prefs as string] : ret_data;
}

export function set_pref(pref: string, value: PrefsType): Promise<void> {
    if (prefs_keys_with_defaults[pref] === value)
        return browser.storage.local.remove(pref);
    else
        return browser.storage.local.set({[pref]: value});
}

export function on_prefs_change(callback: (changes: {[s: string]: Storage.StorageChange}) => void) {
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

export async function get_merged_configured(): Promise<ConfiguredPages> {
    let local_storage_p = browser.storage.local.get({configured_pages: {}});
    // @ts-ignore: configured_private will be defined later or won't be: both cases are covered here. TODO: get rid of it - it won't work with real modules
    let configured_private_data = typeof configured_private !== 'undefined' ? configured_private : await browser.runtime.sendMessage({action: 'get_configured_private'});
    return Object.assign(
        {},
        (await local_storage_p).configured_pages,
        configured_private_data,
        // built_in_configured,
    );
}

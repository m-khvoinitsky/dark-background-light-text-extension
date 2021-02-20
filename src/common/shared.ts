import type { Storage } from 'webextension-polyfill-ts';
import {
    Preference,
    PrefsType,
    ConfiguredPages,
    MethodIndex,
} from './types';
import { methods } from '../methods/methods';

declare const { browser }: typeof import('webextension-polyfill-ts');

export const preferences: Preference[] = [
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
        options: Object.keys(methods).filter((key) => (parseInt(key, 10) >= 0)).map((key) => ({
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

export interface PrefsWithValues {
    [key: string]: PrefsType
}
export const prefs_keys_with_defaults = ((): PrefsWithValues => {
    const result: PrefsWithValues = {};
    preferences.forEach((pref) => { result[pref.name] = pref.value; });
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
        for (const key of prefs) {
            query[key] = prefs_keys_with_defaults[key];
        }
    } else if (Object.prototype.toString.call(prefs) === '[object String]') {
        query = { [prefs as string]: prefs_keys_with_defaults[prefs as string] };
        is_single = true;
    } else if (prefs === undefined || prefs === null) {
        query = prefs_keys_with_defaults;
    } else {
        throw new Error('get_prefs parameter has unsupported type');
    }
    const ret_data = await browser.storage.local.get(query);
    return is_single ? ret_data[prefs as string] : ret_data;
}

export function set_pref(pref: string, value: PrefsType): Promise<void> {
    if (prefs_keys_with_defaults[pref] === value) {
        return browser.storage.local.remove(pref);
    } else {
        return browser.storage.local.set({ [pref]: value });
    }
}

export function on_prefs_change(callback: (changes: {[s: string]: Storage.StorageChange}) => void) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
            throw new Error('unsupported');
        }
        for (const pref of Object.keys(changes)) {
            // if option has been removed, it means that it's value has been set to default
            if (!Object.prototype.hasOwnProperty.call(changes[pref], 'newValue')) {
                // eslint-disable-next-line no-param-reassign
                changes[pref].newValue = prefs_keys_with_defaults[pref];
            }
        }
        callback(changes);
    });
}

export async function get_merged_configured_common(
    get_configured_private: () => Promise<ConfiguredPages>,
): Promise<ConfiguredPages> {
    const local_storage_p = browser.storage.local.get({ configured_pages: {} });
    return {
        ...(await local_storage_p).configured_pages,
        ...(await get_configured_private()),
        // ...built_in_configured,
    };
}

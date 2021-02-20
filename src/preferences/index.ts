import { ConfiguredPages } from '../common/types';
import {
    preferences,
    prefs_keys_with_defaults,
    get_prefs,
    set_pref,
} from '../common/shared';
import { methods } from '../methods/methods';
import { query_style } from '../common/ui-style';

declare const { browser }: typeof import('webextension-polyfill-ts');

function createElement(
    tagName: string,
    classList?: string[],
    id?: string,
    textContent?: string,
    attrs?: {[key: string]: string},
    children?: HTMLElement[],
    properties?: {[key: string]: any},
): HTMLElement {
    const element: HTMLElement = document.createElement(tagName);
    if (classList) {
        classList.forEach((className) => element.classList.add(className));
    }
    if (id) {
        element.setAttribute('id', id);
    }
    if (textContent) {
        element.textContent = textContent;
    }
    if (attrs) {
        Object.keys(attrs).forEach((attr) => element.setAttribute(attr, attrs[attr]));
    }
    if (children) {
        children.forEach((child) => element.appendChild(child));
    }
    if (properties) {
        Object.keys(properties).forEach((property) => {
            (element as any)[property] = properties[property];
        });
    }
    return element;
}

async function update_all() {
    query_style().catch((rej) => console.error(rej));
    // TODO: separate configured pages refresh (see commented code below)
    const saved_prefs = await get_prefs();
    const isTouchscreen = (await browser.runtime.getPlatformInfo()).os === 'android';
    if (document.readyState === 'loading') {
        const at_least_interactive: Promise<void> = new Promise((resolve, _reject) => {
            function readystatechange(event: Event) {
                if ((event.target as HTMLDocument).readyState !== 'loading') {
                    resolve();
                }
            }
            document.addEventListener('readystatechange', readystatechange);
            readystatechange({ target: document } as unknown as Event);
        });
        await at_least_interactive;
    }
    const container = document.querySelector('#main') as HTMLElement;
    const current_preferences = preferences.map((pref) => ({
        ...pref,
        value: saved_prefs[pref.name],
    }));
    if (isTouchscreen) {
        container.classList.add('touchscreen');
    }
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(
        createElement('div', ['row'], undefined, undefined, undefined, [
            createElement('div', ['col-xs-12'], undefined, undefined, undefined, [
                createElement('h2', undefined, undefined, 'Options'),
            ]),
        ]),
    );
    for (const pref of current_preferences) {
        if (pref.name === 'configured_pages') {
            continue;
        }
        const row = createElement('div', ['row'], undefined, undefined, undefined, [
            // title label
            createElement(
                'div',
                pref.type === 'bool'
                    ? ['col-xs-10', 'col-sm-4', 'col-md-4']
                    : ['col-xs-12', 'col-sm-12', 'col-md-4'],
                undefined, undefined, undefined, [
                    createElement('label', ['full-width'], undefined, pref.title, { for: `labeled_pref_${pref.name}` }),
                ],
            ),
        ]);

        // control
        const id = `labeled_pref_${pref.name}`;
        switch (pref.type) {
            case 'menulist':
                row.appendChild(
                    createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-6'], undefined, undefined, undefined, [
                        createElement(
                            'select',
                            [`pref_${pref.name}`, 'full-width', 'form-control'],
                            id, undefined,
                            { 'data-pref-type': pref.type },
                            // children
                            pref.options!.map((option) => createElement(
                                'option', undefined, undefined,
                                option.label,
                                (pref.value === parseInt(option.value, 10))
                                    ? { selected: '' }
                                    : undefined,
                            )),
                            {
                                onchange: (event: Event) => set_pref(
                                    pref.name,
                                    (event.target as HTMLFormElement).selectedIndex,
                                ),
                            },
                        ),
                    ]),
                );
                break;
            case 'color':
                ['color', 'text'].forEach((input_type) => {
                    row.appendChild(createElement('div', ['col-xs-6', 'col-sm-4', 'col-md-3'], undefined, undefined, undefined, [
                        createElement(
                            'input',
                            ['input_color', `input_color_${input_type}`, `pref_${pref.name}`, 'full-width', 'form-control'],
                            (input_type === 'color') ? id : undefined, undefined,
                            {
                                'data-pref-type': pref.type,
                                type: input_type,
                            }, undefined,
                            {
                                onchange: (event: Event) => {
                                    // TODO: support any CSS color format
                                    // RegExp('^#(?:[\\da-fA-F]{3}){1,2}$')
                                    if ((event.target as HTMLFormElement).value.search(new RegExp('^#[\\da-fA-F]{6}$')) === 0) {
                                        set_pref(
                                            pref.name,
                                            (event.target as HTMLFormElement).value,
                                        );
                                    } else {
                                        // eslint-disable-next-line no-param-reassign
                                        (event.target as HTMLFormElement).value = Array.prototype.find.call(document.getElementsByClassName(`pref_${pref.name}`), (node) => (node !== event.target)).value;
                                    }
                                },
                                value: pref.value,
                            },
                        ),
                    ]));
                });
                break;
            case 'bool':
                row.appendChild(
                    createElement('div', ['col-xs-2', 'col-sm-4', 'col-md-6'], undefined, undefined, undefined, [
                        createElement('input', [`pref_${pref.name}`, 'full-width', 'form-control'], id, undefined, {
                            type: 'checkbox',
                            'data-pref-type': pref.type,
                        }, undefined, {
                            checked: pref.value,
                            onchange: (event: Event) => set_pref(
                                pref.name,
                                (event.target as HTMLFormElement).checked,
                            ),
                        }),
                    ]),
                );
                break;
            default:
                console.error(`Unknown pref.type: ${pref.type}`);
        }

        row.appendChild(
            createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2'], undefined, undefined, undefined, [
                createElement('button', ['btn', 'btn-default', 'full-width'], undefined, 'Reset', undefined, undefined, {
                    onclick: () => set_pref(pref.name, prefs_keys_with_defaults[pref.name]),
                }),
            ]),
        );

        container.appendChild(row);
    }
    if ((await browser.runtime.getPlatformInfo()).os !== 'android') {
        container.appendChild(
            createElement('div', ['row'], undefined, undefined, undefined, [
                createElement('div', ['col-xs-12'], undefined, undefined, undefined, [
                    createElement('h2', undefined, undefined, 'Shortcuts'),
                ]),
            ]),
        );
        container.appendChild(createElement('div', undefined, undefined, 'In order to configure shortcuts, go to about:addons (Menu -> Add-ons), press on the cogwheel icon, then choose "Manage Extension Shortcuts"'));
        container.appendChild(createElement('a', undefined, undefined, 'See this support article for the detais', { href: 'https://support.mozilla.org/kb/manage-extension-shortcuts-firefox' }));
    }
    container.appendChild(
        createElement('div', ['row'], undefined, undefined, undefined, [
            createElement('div', ['col-xs-12'], undefined, undefined, undefined, [
                createElement('h2', undefined, undefined, 'Configured pages'),
            ]),
        ]),
    );
    // eslint-disable-next-line no-use-before-define
    update_configured(saved_prefs.configured_pages as ConfiguredPages);
}
function update_configured(data: ConfiguredPages) {
    const container = document.querySelector('#main') as HTMLElement;

    Array.prototype.forEach.call(container.querySelectorAll('.configured_page'), (node) => {
        node.parentNode.removeChild(node);
    });
    if (Object.keys(data).length === 0) {
        container.appendChild(
            createElement('div', ['row', 'configured_page'], undefined, undefined, undefined, [
                createElement('div', ['col-xs-12'], undefined, 'There is no single configured page'),
            ]),
        );
    } else {
        Object.keys(data).forEach((url) => {
            const method = data[url];
            container.appendChild(
                createElement('div', ['row', 'configured_page'], undefined, undefined, undefined, [
                    createElement('div', ['col-xs-12', 'col-sm-12', 'col-md-5', 'col-lg-8', 'configured_page_url'], undefined, url),
                    createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-5', 'col-lg-2'], undefined, methods[method].label),
                    createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2', 'col-lg-2'], undefined, undefined, undefined, [
                        createElement('button', ['btn', 'btn-default', 'full-width'], undefined, 'Remove', {
                            'data-url': url,
                        }, undefined, {
                            onclick: async (event: Event) => {
                                const configured = await get_prefs('configured_pages');
                                delete configured[(event.target as HTMLElement).getAttribute('data-url')!];
                                set_pref('configured_pages', configured);
                            },
                        }),
                    ]),
                ]),
            );
        });
    }
}

browser.storage.onChanged.addListener(update_all);
update_all();

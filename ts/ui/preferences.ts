import type { ConfiguredPages } from '../lib/types';
declare var { preferences, prefs_keys_with_defaults, methods, get_prefs, set_pref }: typeof import('../lib/shared');
declare var { browser }: typeof import('webextension-polyfill-ts');
declare var { query_style }: typeof import('./style');

function createElement(tagName: string, classList?: string[], id?: string, textContent?: string, attrs?: {[key: string]: string}, children?: HTMLElement[], properties?: {[key: string]: any}): HTMLElement {
    let element: HTMLElement = document.createElement(tagName);
    if (classList)
        classList.forEach(function(className){ element.classList.add(className) });
    if (id)
        element.setAttribute('id', id);
    if (textContent)
        element.textContent = textContent;
    if (attrs)
        Object.keys(attrs).forEach(function (attr) {
            element.setAttribute(attr, attrs[attr]);
        });
    if (children)
        children.forEach(function (child) {
            element.appendChild(child);
        });
    if (properties)
        Object.keys(properties).forEach(function (property) {
            (element as any)[property] = properties[property];
        });
    return element;
}

function intersection(setA: Set<any>, setB: Set<any>) {
    let intersection = new Set();
    for (let elem of setB) {
        if (setA.has(elem)) {
            intersection.add(elem);
        }
    }
    return intersection;
}
function union(...args: any[]) {
    let union = new Set(args.shift());
    for (let set of args) {
        for (let elem of set) {
            union.add(elem);
        }
    }
    return union;
}
const grabshortcut_downKeys = new Set();
let grabshortcut_target = '';
const modifiers = new Set([
    'Ctrl',
    'MacCtrl',
    'Command',
    'Alt',
]);
const secondary_modifiers = new Set([
    'Shift',
]);
// 'A', 'B', ... 'Z'
const letters = new Set(Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)));
// '0', '1', ... '9'
const numbers = new Set(Array.from({length: 10}, (_, i) => `${i}`));
// 'F1', 'F2', ... 'F24'
const func_keys = new Set(Array.from({length: 24}, (_, i) => `F${i + 1}`));
const media_keys = new Set([
    'MediaPrevTrack',
    'MediaNextTrack',
    'MediaPlayPause',
    'MediaStop',
]);
const other = new Set([
    'Space',
    'Comma',
    'Period',
    'Left',
    'Up',
    'Right',
    'Down',
    'Delete',
    'End',
    'PageDown',
    'PageUp',
    'Home',
    'Insert',
]);
function grabshortcut_format(is_for_echo: boolean): string {
    let order = [];
    for (let what of [
        modifiers,
        secondary_modifiers,
        union(letters, numbers, func_keys, media_keys, other),
    ]) {
        let found = intersection(grabshortcut_downKeys, what);
        if (found.size > 0)
            found.forEach(k => order.push(k));
    }
    if (is_for_echo)
        order.push('...');
    return order.join(is_for_echo ? ' + ' : '+');
}
function grabshortcut_submit() {
    let node = document.querySelector(`.pref_${grabshortcut_target}`) as HTMLFormElement;
    node.value = grabshortcut_format(false);
    let change = new Event('change');
    node.dispatchEvent(change);
    grabshortcut_exit();
}
function grabshortcut_verify() {
    // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/commands#Shortcut_values

    if (intersection(grabshortcut_downKeys, media_keys).size === 1) {
        if (grabshortcut_downKeys.size === 1) {
            grabshortcut_submit();
        }
    }

    if (intersection(grabshortcut_downKeys, func_keys).size === 1) {
        grabshortcut_submit();
    }

    if (intersection(grabshortcut_downKeys, union(letters, numbers, other)).size === 1) {
        if (intersection(grabshortcut_downKeys, modifiers).size === 1) {
            grabshortcut_submit();
        }
    }
    (document.querySelector('#grab-hotkey') as HTMLElement).innerText = grabshortcut_format(true);
}
function grabshortcut_exit() {
    document.querySelector('#grab-overlay')!.classList.add('hidden');
    document.querySelector('#main')!.classList.remove('blurred');
    window.removeEventListener('keydown', grabshortcut_keyupdown);
    window.removeEventListener('keyup', grabshortcut_keyupdown);
}
const grabshortcut_map: {[key: string]: string} = {
    'Control': 'Ctrl',
    'MediaTrackPrevious': 'MediaPrevTrack',
    'MediaTrackNext': 'MediaNextTrack',
};
if (window.navigator.platform.toLowerCase().includes('mac'))
    Object.assign(grabshortcut_map, {
        'Control': 'MacCtrl',
        'OS': 'Command',
    });
function grabshortcut_keyupdown(event: KeyboardEvent) {
    event.preventDefault();
    let code = event.code;
    let key;
    if (code.indexOf('Key') === 0)
        key = code.replace('Key', '');
    else if (code.indexOf('Digit') === 0)
        key = code.replace('Digit', '');
    else if (code.includes('Arrow'))
        key = code.replace('Arrow', '');
    else if (code.includes('Left') || code.includes('Right')) // and not includes('Arrow') (which handled above)
        key = code.replace('Left', '').replace('Right', '');
    else
        key = code;
    if (grabshortcut_map.hasOwnProperty(key))
        key = grabshortcut_map[key];
    switch (event.type) {
        case 'keydown':
            grabshortcut_downKeys.add(key);
            break;
        case 'keyup':
            if (key === 'Escape')
                grabshortcut_exit();
            if (grabshortcut_downKeys.has(key))
                grabshortcut_downKeys.delete(key);
            break;
    }
    grabshortcut_verify();
}
function grabshortcut_start(pref_name: string) {
    grabshortcut_downKeys.clear();
    grabshortcut_target = pref_name;
    (document.querySelector('#grab-hotkey') as HTMLElement).innerText = '...';
    (document.querySelector('#grab-overlay') as HTMLElement).classList.remove('hidden');
    (document.querySelector('#main') as HTMLElement).classList.add('blurred');
    (document.querySelector('#grab-stop') as HTMLElement).onclick = grabshortcut_exit;
    window.addEventListener('keydown', grabshortcut_keyupdown);
    window.addEventListener('keyup', grabshortcut_keyupdown);
}

async function update_all() {
    query_style().catch(rej => console.exception(rej));
    //TODO: separate configured pages refresh (see commented code below)
    let saved_prefs = await get_prefs();
    let isTouchscreen = (await browser.runtime.getPlatformInfo()).os === 'android';
    if (document.readyState === 'loading') {
        let at_least_interactive = new Promise((resolve, _reject) => {
            function readystatechange(event: Event) {
                if ((event.target as HTMLDocument).readyState !== 'loading')
                    resolve();
            }
            document.addEventListener('readystatechange', readystatechange);
            readystatechange({target: document} as unknown as Event);
        });
        await at_least_interactive;
    }
    let container = document.querySelector('#main') as HTMLElement;
    let current_preferences = preferences.map(pref => Object.assign({}, pref, {
        value: saved_prefs[pref.name],
    }));
    if (isTouchscreen)
        container.classList.add('touchscreen');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(
        createElement('div', ['row'], undefined, undefined, undefined, [
            createElement('div', ['col-xs-12'], undefined, undefined, undefined, [
                createElement('h2', undefined, undefined, 'Options')
            ])
        ])
    );
    for (let pref of current_preferences) {
        if (pref.hasOwnProperty('available') && !(await pref.available))
            continue;
        if (pref.name === 'configured_pages')
            continue;
        let row = createElement('div', ['row'], undefined, undefined, undefined, [
            // title label
            createElement(
                'div',
                pref.type === 'bool' ?
                    ['col-xs-10', 'col-sm-4', 'col-md-4'] :
                    ['col-xs-12', 'col-sm-12', 'col-md-4'],
                undefined, undefined, undefined, [
                    createElement('label', ['full-width'], undefined, pref.title, {for: `labeled_pref_${pref.name}`})
                ]
            )
        ]);

        // control
        var id = `labeled_pref_${pref.name}`;
        switch (pref.type) {
            case 'menulist':
                row.appendChild(
                    createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-6'], undefined, undefined, undefined, [
                        createElement(
                            'select',
                            ['pref_'+pref.name, 'full-width', 'form-control'],
                            id, undefined,
                            { 'data-pref-type': pref.type },
                            // children
                            pref.options!.map(function (option) {
                                return createElement(
                                    'option', undefined, undefined,
                                    option.label,
                                    (pref.value === parseInt(option.value)) ? {selected: ''} : undefined
                                )
                            }),
                            {onchange: function(event: Event) {
                                set_pref(pref.name, (event.target as HTMLFormElement).selectedIndex);
                            }}
                        )
                    ])
                );
                break;
            case 'color':
                ['color', 'text'].forEach(function(input_type) {
                    row.appendChild(createElement('div', ['col-xs-6', 'col-sm-4', 'col-md-3'], undefined, undefined, undefined, [
                        createElement(
                            'input',
                            ['input_color', 'input_color_' + input_type, 'pref_' + pref.name, 'full-width', 'form-control'],
                            (input_type === 'color') ? id : undefined, undefined,
                            {
                                'data-pref-type': pref.type,
                                type: input_type
                            }, undefined,
                            {
                                onchange: function(event: Event){
                                    //TODO: support any CSS color format // RegExp('^#(?:[\\da-fA-F]{3}){1,2}$')
                                    if ((event.target as HTMLFormElement).value.search(new RegExp('^#[\\da-fA-F]{6}$')) === 0) {
                                        set_pref(pref.name, (event.target as HTMLFormElement).value);
                                    } else {
                                        (event.target as HTMLFormElement).value = Array.prototype.find.call(document.getElementsByClassName('pref_' + pref.name), function(node) {return node !== event.target}).value;
                                    }
                                },
                                value: pref.value
                            }
                        )
                    ]));
                });
                break;
            case 'hotkey':
                row.appendChild(
                    createElement('div', ['col-xs-6', 'col-sm-4', 'col-md-3'], undefined, undefined, undefined, [
                        createElement(
                            'input',
                            [`pref_${pref.name}`, 'full-width', 'form-control'],
                            id,
                            undefined,
                            {
                                type: 'text',
                                'data-pref-type': pref.type,
                            }, undefined, {
                                value: pref.value,
                                onchange: function(event: Event){
                                    set_pref(pref.name, (event.target as HTMLFormElement).value);
                                },
                            }
                        ),
                    ])
                );
                row.appendChild(
                    createElement('div', ['col-xs-6', 'col-sm-4', 'col-md-3'], undefined, undefined, undefined, [
                        createElement(
                            'button',
                            ['btn', 'btn-default', 'full-width'],
                            undefined,
                            'Grab',
                            {},
                            undefined,
                            {
                                onclick: (_event: Event) => grabshortcut_start(pref.name),
                            }
                        ),
                    ])
                );
                break;
            case 'bool':
                row.appendChild(
                    createElement('div', ['col-xs-2', 'col-sm-4', 'col-md-6'], undefined, undefined, undefined, [
                        createElement('input', ['pref_'+pref.name, 'full-width', 'form-control'], id, undefined, {
                            type: 'checkbox',
                            'data-pref-type': pref.type
                        }, undefined, {
                            checked: pref.value,
                            onchange: function(event: Event){
                                set_pref(pref.name, (event.target as HTMLFormElement).checked);
                            }
                        })
                    ])
                );
                break;
        }

        row.appendChild(
            createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2'], undefined, undefined, undefined, [
                createElement('button', ['btn', 'btn-default', 'full-width'], undefined, 'Reset', undefined, undefined, {
                    onclick: () => set_pref(pref.name, prefs_keys_with_defaults[pref.name]),
                })
            ])
        );

        container.appendChild(row);
    }
    container.appendChild(
        createElement('div', ['row'], undefined, undefined, undefined, [
            createElement('div', ['col-xs-12'], undefined, undefined, undefined, [
                createElement('h2', undefined, undefined, 'Configured pages')
            ])
        ])
    );
    update_configured(saved_prefs['configured_pages'] as ConfiguredPages);
}
function update_configured(data: ConfiguredPages) {
    let container = document.querySelector('#main') as HTMLElement;

    Array.prototype.forEach.call(container.querySelectorAll('.configured_page'), function(node) {
        node.parentNode.removeChild(node);
    });
    if (Object.keys(data).length === 0) {
        container.appendChild(
            createElement('div', ['row', 'configured_page'], undefined, undefined, undefined, [
                createElement('div', ['col-xs-12'], undefined, 'There is no single configured page')
            ])
        );
    } else
        Object.keys(data).forEach(function (url) {
            let method = data[url];
            container.appendChild(
                createElement('div', ['row', 'configured_page'], undefined, undefined, undefined, [
                    createElement('div', ['col-xs-12', 'col-sm-12', 'col-md-5', 'col-lg-8', 'configured_page_url'], undefined, url),
                    createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-5', 'col-lg-2'], undefined, methods[method].label),
                    createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2', 'col-lg-2'], undefined, undefined, undefined, [
                        createElement('button', ['btn', 'btn-default', 'full-width'], undefined, 'Remove', {
                            'data-url': url,
                        }, undefined, {
                            onclick: async function (event: Event) {
                                let configured = await get_prefs('configured_pages');
                                delete configured[(event.target as HTMLElement).getAttribute('data-url')!];
                                set_pref('configured_pages', configured);
                            },
                        }),
                    ]),
                ])
            );
        });
}
// self.port.on('refresh-configured', update_configured);

// self.port.on('refresh', function(data){
//     Array.prototype.forEach.call(document.getElementsByClassName('pref_' + data.name), function(node) {
//         switch (node.getAttribute('data-pref-type')) {
//             case 'menulist':
//                 node.selectedIndex = data.value;
//                 break;
//             case 'color':
//                 node.value = data.value;
//                 break;
//             case 'bool':
//                 node.checked = data.value;
//                 break;
//         }
//     });
// });
browser.storage.onChanged.addListener(update_all);
update_all();

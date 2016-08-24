"use strict";

function createElement(tagName, classList, id, textContent, attrs, children, properties) {
    var element = document.createElement(tagName);
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
            element[property] = properties[property];
        });
    return element;
}

var methods;
self.port.on('style', function(css){
    var container = document.head ? document.head : document.documentElement;
    var style = createElement('style', null, null, css);
    if (container.firstChild)
        container.insertBefore(style, container.firstChild);
    else
        container.appendChild(style);
});

self.port.on('init', function(data){
    methods = data['methods'];
    var isTouchscreen = data['isTouchscreen'];
    var container = document.querySelector('#main');
    if (isTouchscreen)
        container.classList.add('touchscreen');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(
        createElement('div', ['row'], null, null, null, [
            createElement('div', ['col-xs-12'], null, null, null, [
                createElement('h2', null, null, 'Options')
            ])
        ])
    );
    data.preferences.forEach(function(pref){
        var row = createElement('div', ['row'], null, null, null, [
            // title label
            createElement(
                'div',
                pref.type === 'bool' ?
                    ['col-xs-10', 'col-sm-4', 'col-md-4'] :
                    ['col-xs-12', 'col-sm-12', 'col-md-4'],
                null, null, null, [
                    createElement('label', ['full-width'], null, pref.title, {for: 'labeled_pref_'+pref.name})
                ]
            )
        ]);

        // control
        var col;
        var id = 'labeled_pref_'+pref.name;
        switch (pref.type) {
            case 'menulist':
                row.appendChild(
                    createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-6'], null, null, null, [
                        createElement(
                            'select',
                            ['pref_'+pref.name, 'full-width', 'form-control'],
                            id, null,
                            { 'data-pref-type': pref.type },
                            // children
                            pref.options.map(function (option) {
                                return createElement(
                                    'option', null, null,
                                    option.label,
                                    (pref.value === parseInt(option.value)) ? {selected: ''} : null
                                )
                            }),
                            {onchange: function(event) {
                                self.port.emit('settings-changed', {
                                    name: pref.name,
                                    value: event.target.selectedIndex
                                });
                            }}
                        )
                    ])
                );
                break;
            case 'color':
                ['color', 'text'].forEach(function(input_type) {
                    row.appendChild(createElement('div', ['col-xs-6', 'col-sm-4', 'col-md-3'], null, null, null, [
                        createElement(
                            'input',
                            ['input_color', 'input_color_' + input_type, 'pref_' + pref.name, 'full-width', 'form-control'],
                            (input_type === 'color') ? id : null, null,
                            {
                                'data-pref-type': pref.type,
                                type: input_type
                            }, null,
                            {
                                onchange: function(event){
                                    //TODO: support any CSS color format // RegExp('^#(?:[\\da-fA-F]{3}){1,2}$')
                                    if (event.target.value.search(new RegExp('^#[\\da-fA-F]{6}$')) === 0) {
                                        self.port.emit('settings-changed', {
                                            name: pref.name,
                                            value: event.target.value
                                        })
                                    } else {
                                        event.target.value = Array.prototype.find.call(document.getElementsByClassName('pref_' + pref.name), function(node) {return node !== event.target}).value;
                                    }
                                },
                                value: pref.value
                            }
                        )
                    ]));
                });
                break;
            case 'bool':
                row.appendChild(
                    createElement('div', ['col-xs-2', 'col-sm-4', 'col-md-6'], null, null, null, [
                        createElement('input', ['pref_'+pref.name, 'full-width', 'form-control'], id, null, {
                            type: 'checkbox',
                            'data-pref-type': pref.type
                        }, null, {
                            checked: pref.value,
                            onchange: function(event){
                                self.port.emit('settings-changed', {
                                    name: pref.name,
                                    value: event.target.checked
                                })
                            }
                        })
                    ])
                );
                break;
        }

        row.appendChild(
            createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2'], null, null, null, [
                createElement('button', ['btn', 'btn-default', 'full-width'], null, 'Reset', null, null, {
                    onclick: function(){ self.port.emit('settings-reset', pref.name) }
                })
            ])
        );

        container.appendChild(row);
    });
    container.appendChild(
        createElement('div', ['row'], null, null, null, [
            createElement('div', ['col-xs-12'], null, null, null, [
                createElement('h2', null, null, 'Configured pages')
            ])
        ])
    );
    update_configured(data['configured_pages']);
});
function update_configured(data) {
    let container = document.querySelector('#main');

    Array.prototype.forEach.call(container.querySelectorAll('.configured_page'), function(node) {
        node.parentNode.removeChild(node);
    });
    if (Object.keys(data).length === 0) {
        container.appendChild(
            createElement('div', ['row', 'configured_page'], null, null, null, [
                createElement('div', ['col-xs-12'], null, 'There is no single configured page')
            ])
        )
    } else
        Object.keys(data).forEach(function (url) {
        let method = data[url];
        container.appendChild(
            createElement('div', ['row', 'configured_page'], null, null, null, [
                createElement('div', ['col-xs-12', 'col-sm-12', 'col-md-5', 'col-lg-8', 'configured_page_url'], null, url),
                createElement('div', ['col-xs-12', 'col-sm-8', 'col-md-5', 'col-lg-2'], null, methods[method].label),
                createElement('div', ['col-xs-12', 'col-sm-4', 'col-md-2', 'col-lg-2'], null, null, null, [
                    createElement('button', ['btn', 'btn-default', 'full-width'], null, 'Remove', {
                        'data-url': url
                    }, null, {
                        onclick: function (event) {
                            self.port.emit('remove-configured', event.target.getAttribute('data-url'));
                        }
                    })
                ])
            ])
        );
    })
}
self.port.on('refresh-configured', update_configured);
self.port.on('refresh', function(data){
    Array.prototype.forEach.call(document.getElementsByClassName('pref_' + data.name), function(node) {
        switch (node.getAttribute('data-pref-type')) {
            case 'menulist':
                node.selectedIndex = data.value;
                break;
            case 'color':
                node.value = data.value;
                break;
            case 'bool':
                node.checked = data.value;
                break;
        }
    });
});
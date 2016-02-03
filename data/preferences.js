self.port.on('init', function(data){
    var isTouchscreen = data['isTouchscreen'];
    var body = document.querySelector('body');
    if (isTouchscreen)
        body.setAttribute('class', 'touchscreen');
    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }
    var container = document.createElement('div');
    var table = document.createElement('table');
    data.preferences.forEach(function(pref){
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.textContent = pref.title;
        tr.appendChild(td);
        td = document.createElement('td');
        switch (pref.type) {
            case 'menulist':
                var select = document.createElement('select');
                select.classList.add('pref_'+pref.name);
                pref.options.forEach(function(option){
                    var option_t = document.createElement('option');
                    option_t.textContent = option.label;
                    if (pref.value === parseInt(option.value))
                        option_t.setAttribute('selected', '');
                    select.appendChild(option_t);
                });
                select.onchange = function() {
                    self.port.emit('settings-changed', {
                        name: pref.name,
                        value: select.selectedIndex
                    });
                };
                select.setAttribute('data-pref-type', pref.type);
                td.appendChild(select);
                break;
            case 'color':
                ['color', 'text'].forEach(function(input_type) {
                    var input = document.createElement('input');
                    input.classList.add(
                        'input_color',
                        'input_color_' + input_type,
                        'pref_' + pref.name
                    );
                    input.setAttribute('data-pref-type', pref.type);
                    input.setAttribute('type', input_type);
                    if (input_type === 'text')
                        input.setAttribute('size', 7);
                    input.value = pref.value;
                    input.onchange = function(){
                        //TODO: support any CSS color format // RegExp('^#(?:[\\da-fA-F]{3}){1,2}$')
                        if (input.value.search(new RegExp('^#[\\da-fA-F]{6}$')) === 0) {
                            self.port.emit('settings-changed', {
                                name: pref.name,
                                value: input.value
                            })
                        } else {
                            input.value = Array.prototype.find.call(document.getElementsByClassName('pref_' + pref.name), function(node) {return node !== input}).value;
                        }
                    };
                    td.appendChild(input);
                });
                break;
            case 'bool':
                var input = document.createElement('input');
                input.classList.add('pref_'+pref.name);
                input.setAttribute('type', 'checkbox');
                input.checked = pref.value;
                input.onchange = function(){
                    self.port.emit('settings-changed', {
                        name: pref.name,
                        value: input.checked
                    })
                };
                input.setAttribute('data-pref-type', pref.type);
                td.appendChild(input);
                break;
        }
        tr.appendChild(td);
        td = document.createElement('td');
        var button = document.createElement('button');
        button.textContent = 'Reset';
        button.onclick = function(){
            self.port.emit('settings-reset', pref.name)
        };
        td.appendChild(button);
        tr.appendChild(td);
        table.appendChild(tr);
    });
    container.appendChild(table);
    body.appendChild(container);
});
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
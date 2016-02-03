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
                select.setAttribute('id', 'pref_'+pref.name);
                select.setAttribute('data-pref-type', pref.type);
                td.appendChild(select);
                break;
            case 'color':
                var input = document.createElement('input');
                input.setAttribute('type', 'color');
                input.value = pref.value;
                input.onchange = function(){
                    self.port.emit('settings-changed', {
                        name: pref.name,
                        value: input.value
                    })
                };
                input.setAttribute('id', 'pref_'+pref.name);
                input.setAttribute('data-pref-type', pref.type);
                td.appendChild(input);
                break;
            case 'bool':
                input = document.createElement('input');
                input.setAttribute('type', 'checkbox');
                input.checked = pref.value;
                input.onchange = function(){
                    self.port.emit('settings-changed', {
                        name: pref.name,
                        value: input.checked
                    })
                };
                input.setAttribute('id', 'pref_'+pref.name);
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
    var node = document.getElementById('pref_'+data.name);
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
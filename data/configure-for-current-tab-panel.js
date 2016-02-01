self.port.on('init', function(data){
    var methods = data["methods"];
    var configured = data["configured"];
    var urls = data["urls"]["list"];
    var preselect = data["urls"]["preselect"];
    var isPrivate = data["isPrivate"];
    var isTouchscreen = data['isTouchscreen'];
    var body = document.querySelector('body');
    if (isTouchscreen)
        body.setAttribute('class', 'touchscreen');
    var title = document.createElement('div');
    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }

    var handle_choose_url = function(){
        var current_url_method = configured[document.querySelector('#url_select').value];
        if (current_url_method)
            document.querySelector("#method_"+current_url_method).checked = true;
        else
            document.querySelector("#method_-1").checked = true;
    };

    title.textContent = 'Dark background and light text options for:';
    body.appendChild(title);
    var select = document.createElement('select');
    select.id = 'url_select';
    select.onchange = handle_choose_url;
    for (var url in urls){
        var option = document.createElement('option');
        option.textContent = urls[url];
        if (urls[url] === preselect)
            option.setAttribute('selected', 'true');
        select.appendChild(option);
    }
    body.appendChild(select);
    if (isPrivate){
        var private_note = document.createElement('div');
        private_note.textContent = 'Note: this settings will not be saved for private tabs.';
        body.appendChild(private_note);
    }
    var form_methods = document.createElement('form');
    var ul_methods = document.createElement('ul');
    form_methods.appendChild(ul_methods);

    var handle_method_change = function () {
        var methods = document.querySelectorAll("input.methods");
        var checked_method;
        for (var i = 0; i < methods.length; ++i)
            if (methods[i].checked)
            {
                checked_method = methods[i];
                break
            }
        self.port.emit('settings-changed', {
            "url": document.querySelector('#url_select').value,
            "method": checked_method.value,
            "isPrivate": isPrivate
        });
    };

    for (var method in methods){
        if (parseInt(method) > -5) {  // TODO: document it somehow? (or remove?)
            var li = document.createElement('li');
            var input = document.createElement('input');
            var label = document.createElement('span');
            var label_click = document.createElement('label');
            var spacer1 = document.createElement('span');
            var spacer2 = document.createElement('span');
            spacer1.setAttribute('class', 'spacer');
            spacer2.setAttribute('class', 'spacer');
            input.type = 'radio';
            input.name = 'method';
            input.value = methods[method]['number'];
            input.id = "method_" + methods[method]['number'];
            input.className = "methods";
            label.textContent = methods[method]['label'];
            label.setAttribute('class', 'label_no_click');
            label_click.setAttribute("for", input.id);
            label_click.setAttribute('class', 'label_click_workaround');
            li.appendChild(label_click);
            li.appendChild(spacer1);
            li.appendChild(input);
            li.appendChild(spacer2);
            li.appendChild(label);
            input.onchange = handle_method_change;
            ul_methods.appendChild(li);
        }
    }
    body.appendChild(form_methods);
    handle_choose_url();

    var preferences = document.createElement('div');
    var preferences_note = document.createTextNode('Configure colors, "Default" behaviour and more here: ');
    preferences.appendChild(preferences_note);

    var prefs_button = document.createElement('button');
    prefs_button.setAttribute('icon', 'properties');
    prefs_button.textContent = 'Global Preferences';
    prefs_button.onclick = function() {self.port.emit('open-preferences')};
    preferences.appendChild(prefs_button);

    body.appendChild(preferences);
});
function style(css){
    var sdk_style = document.getElementById('sdk-panel-style');
    if (sdk_style)
        sdk_style.parentNode.removeChild(sdk_style);
    var container = document.head ? document.head : document.documentElement;
    var style = document.getElementById('system-style');
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('id', 'system-style');
    }
    style.textContent = css;
    if (style.parentNode !== container)
        container.insertBefore(style, container.firstChild);
}

self.port.on('init', function(data){
    style(data["style"]);
    var methods = data["methods"];
    var configured = data["configured"];
    var urls = data["urls"]["list"];
    var preselect = data["urls"]["preselect"];
    var isPrivate = data["isPrivate"];
    var isTouchscreen = data['isTouchscreen'];
    var enabled = data['enabled'];
    var body = document.querySelector('body');
    if (isTouchscreen)
        body.setAttribute('class', 'touchscreen');

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

    var checkbox_label = document.createElement('label');
    checkbox_label.setAttribute('class', 'enabled_label');
    checkbox_label.textContent = 'Enabled';
    var checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = enabled;
    checkbox.onchange = function(){
        self.port.emit('enabled-change', checkbox.checked);
    };
    checkbox_label.appendChild(checkbox);
    body.appendChild(checkbox_label);

    body.appendChild(document.createElement('hr'));

    var container = document.createElement('div');
    container.setAttribute('class', 'page_settings_container');
    container.style.position = 'relative';

    if (!enabled) {
        var overlay = document.createElement('div');
        overlay.setAttribute('class', 'disabled_overlay');
        container.appendChild(overlay);
    }

    var title = document.createElement('div');
    title.textContent = 'Dark Background and Light Text options for:';
    title.setAttribute('class', 'options_for');
    container.appendChild(title);
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
    container.appendChild(select);
    if (isPrivate){
        var private_note = document.createElement('div');
        private_note.textContent = 'Note: this settings will not be saved for private tabs.';
        container.appendChild(private_note);
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
            li.appendChild(input);
            li.appendChild(label);
            input.onchange = handle_method_change;
            ul_methods.appendChild(li);
        }
    }
    container.appendChild(form_methods);
    body.appendChild(container);
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
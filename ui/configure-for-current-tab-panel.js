(async function() {
    query_style().catch(rej => console.exception(rej));
    let current_tab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
    let url = current_tab.url;

    function close() {
        window.close(); // works for pop-up on desktop
        if (!current_tab.active) // this is the case for Fennec where pop-up is actually a tab
            browser.tabs.update(current_tab.id, {active: true}); // activating any tab other than our fake pop-up will close pop-up
    }

    let message = false;
    try {
        await browser.tabs.executeScript(current_tab.id, {
            code: '{}',
            runAt: 'document_start',
        });
    } catch (e) {
        message = `Modification of this page is not available due to ${(await browser.runtime.getBrowserInfo()).name} restrictions`;
    }
    if (!message) {
        if (url.indexOf(browser.runtime.getURL('/')) === 0)
            message = 'Extension\'s own internal pages are already well configured';
    }

    let configured = await get_merged_configured();
    let { preselect, list:urls } = await generate_urls(url);
    let isPrivate = current_tab.incognito;
    let enabled = await get_prefs('enabled');
    let body = document.querySelector('body');
    if ((await browser.runtime.getPlatformInfo()).os === 'android')
        body.setAttribute('class', 'touchscreen');

    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }

    function handle_choose_url(){
        let current_url_method = configured[document.querySelector('#url_select').value];
        if (current_url_method)
            document.querySelector(`#method_${current_url_method}`).checked = true;
        else
            document.querySelector('#method_-1').checked = true;
    }

    let checkbox_label = document.createElement('label');
    checkbox_label.setAttribute('class', 'enabled_label');
    checkbox_label.textContent = 'Enabled';
    let checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = enabled;
    checkbox.onchange = () => { set_pref('enabled', checkbox.checked); close(); };
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
    if (message) {
        let msg = document.createElement('div');
        msg.textContent = message;
        msg.setAttribute('class', 'error_msg');
        container.appendChild(msg);
    } else {
        var title = document.createElement('div');
        title.textContent = 'Dark Background and Light Text options for:';
        title.setAttribute('class', 'options_for');
        container.appendChild(title);
        var select = document.createElement('select');
        select.id = 'url_select';
        select.onchange = handle_choose_url;
        for (let url in urls) {
            var option = document.createElement('option');
            option.textContent = urls[url];
            if (urls[url] === preselect)
                option.setAttribute('selected', 'true');
            select.appendChild(option);
        }
        container.appendChild(select);
        if (isPrivate) {
            var private_note = document.createElement('div');
            private_note.textContent = 'Note: this settings will not be saved for private tabs.';
            container.appendChild(private_note);
        }
        var form_methods = document.createElement('form');
        var ul_methods = document.createElement('ul');
        form_methods.appendChild(ul_methods);

        var handle_method_change = async function () {
            let methods = document.querySelectorAll("input.methods");
            let checked_method;
            for (let i = 0; i < methods.length; ++i) {
                if (methods[i].checked) {
                    checked_method = methods[i];
                    break
                }
            }
            let method_n = checked_method.value;
            let url = document.querySelector('#url_select').value;

            if (!isPrivate) {
                let configured_pages = await get_prefs('configured_pages');
                if (method_n < 0)
                    delete configured_pages[url];
                else
                    configured_pages[url] = method_n;
                await set_pref('configured_pages', configured_pages);
            } else {
                browser.runtime.sendMessage({
                    action: 'set_configured_private',
                    key: url,
                    value: method_n >= 0 ? method_n : null,
                });
            }
            close();
        };

        for (var method in methods) {
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
    }
    body.appendChild(container);
    if (!message)
        handle_choose_url();

    var preferences = document.createElement('div');
    var preferences_note = document.createTextNode('Configure colors, "Default" behaviour and more here: ');
    preferences.appendChild(preferences_note);

    var prefs_button = document.createElement('button');
    prefs_button.setAttribute('icon', 'properties');
    prefs_button.textContent = 'Global Preferences';
    prefs_button.onclick = () => { /* see bug 1414917 */ browser.runtime.sendMessage({action: 'open_options_page'}); close(); };
    preferences.appendChild(prefs_button);

    body.appendChild(preferences);
})().catch(rejection => console.error(rejection));

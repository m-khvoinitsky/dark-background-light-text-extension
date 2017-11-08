async function query_style() {
    let css_promise = await browser.runtime.sendMessage({action: 'query_base_style'});

    let ext_style = document.getElementById('base-extension-style');
    if (!ext_style) {
        let container = document.head ? document.head : document.documentElement;
        ext_style = document.createElement('style');
        ext_style.setAttribute('id', 'base-extension-style');
        container.appendChild(ext_style);
    }
    ext_style.textContent = await css_promise;
}
if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', event => {
        query_style().catch(rejection => console.error(rejection));
    }, {once: true});
} else {
    query_style().catch(rejection => console.error(rejection));
}

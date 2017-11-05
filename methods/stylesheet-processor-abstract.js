"use strict";

const count_char_in_string = (char, str) => {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
const brackets_aware_split = (value, separator) => {
    // TODO: handle more complex cases
    if (!separator)
        separator = ',';
    let result = [];
    let current = [];
    let depth = 0;
    let splitted = value.split(separator);
    for (let i = 0; i < splitted.length; i++) {
        current.push(splitted[i].trim());
        depth += count_char_in_string('(', splitted[i]);
        depth -= count_char_in_string(')', splitted[i]);
        if (depth === 0) {
            result.push(current.join(separator));
            current = [];
        }
    }
    return result;
};

const inline_override_stylesheet_id = 'dark-background-light-text-add-on-inline-style-override';
const quote_re = new RegExp('"', 'g');
const important_re = new RegExp('!important;', 'g');

class StylesheetProcessorAbstract {
    constructor(window, options, style_selector) {
        this.window = window;
        this.url = window.document.documentURI;
        this.processed_stylesheets = new WeakMap();
        this.processed_htmlelements = new WeakMap();
        this.workaround_requested = new WeakSet();
        this.broken_stylesheets = new WeakSet();
        this.style_selector = (!!style_selector) ? style_selector : '[style]';
        function process_MO_record(record) {
            if (
                (record.type !== 'attributes') ||
                (!record.attributeName || record.attributeName !== 'style') ||
                (!record.target) ||
                (record.target.getAttribute('id') === 'main-window') ||
                (record.target.getAttribute('id') === 'content') ||
                (record.target.getAttribute('id') === 'browser-bottombox') ||
                (record.target.getAttribute('id') === 'identity-box')
            ) return;
            let node = record.target;
            //console.log('processing mutated node');
            //console.log(node);
            //console.log(node.getAttribute('style'));
            if (this.processed_htmlelements.get(node).last !== node.getAttribute('style')) {
                //console.log('style has been changed. processing...');
                this.process_HTMLElement(node);
            } else {
                //console.log('style not changed');
            }
        }
        this.mutationObserver = new this.window.MutationObserver(records => records.forEach(process_MO_record, this));
        this.options = options;
        this.stop = false;
    }
    load_into_window(window, options) {
        this.process();
        this.handle_visibilitychange = event => {
            if (this.stop)
                return;
            if (this.window.document.hidden && (this.window.document.readyState === 'complete'))
                return;
            this.process();
        };
        this.window.document.addEventListener('visibilitychange', this.handle_visibilitychange);
        this.window.addEventListener('unload', event => {
            this.unload_from_window(true);
            //TODO: may be move it to stylesheet-processor.js?
        })
    }
    unload_from_window(light) {
        this.stop = true;
        this.window.document.removeEventListener('visibilitychange', this.handle_visibilitychange);
        this.mutationObserver.disconnect();
        if (!light) { // "light unloading" (used in case when document is about to be destroyed)
            let inline_override_stylesheet = this.window.document.getElementById(inline_override_stylesheet_id);
            inline_override_stylesheet && inline_override_stylesheet.parentNode.removeChild(inline_override_stylesheet);
            let ownerNodes = Array.prototype.map.call(this.window.document.styleSheets, sheet => sheet.ownerNode);
            ownerNodes.forEach(ownerNode => {
                if (ownerNode.hasAttribute('data-is-imported')) {
                    ownerNode.parentNode.removeChild(ownerNode);
                } else {
                    let parentNode = ownerNode.parentNode;
                    let insertBefore = ownerNode.nextSibling;
                    parentNode.removeChild(ownerNode);
                    if (ownerNode.hasAttribute('data-original-href')) {
                        ownerNode.setAttribute('href', ownerNode.getAttribute('data-original-href'));
                        ownerNode.removeAttribute('data-original-href');
                    }
                    if (ownerNode.hasAttribute('data-relative-to')) {
                        ownerNode.removeAttribute('data-relative-to');
                    }
                    parentNode.insertBefore(ownerNode, insertBefore);
                }
            });
            Array.prototype.forEach.call(
                this.window.document.querySelectorAll(this.style_selector),
                    node => {
                    if (this.processed_htmlelements.has(node)) {
                        node.setAttribute('style', this.processed_htmlelements.get(node).original);
                        this.processed_htmlelements.delete(node);
                    }
                }
            )
        }
    }
    process(no_schedule) {
        //TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=839103
        //
        if (this.stop)
            return;

        try {
            this.window.document;
        } catch (e) {
            // window is dead
            // console.log('window is dead', this.url);
            this.stop = true;
            return;
        }

        /*if ((!('changed' in this)) && this.url != this.window.document.documentURI) {
            // TODO: investigate it more deeply
            console.log('document url changed', {old_url: this.url, new_url: this.window.document.documentURI, new_href: this.window.location.href});
            this.changed = true;
            console.log('stopping work, bad doc', this.url, this.window.document.documentURI);
            this.stop = true;
            return;
        }*/

        Array.prototype.forEach.call(this.window.document.styleSheets, sheet => {
            if (!this.processed_stylesheets.has(sheet) && sheet !== this.inline_override && !this.broken_stylesheets.has(sheet)) {
                let process_result = this.process_CSSStyleSheet(sheet);
                if (process_result === true)
                    this.processed_stylesheets.set(sheet, sheet.cssRules.length);
                // else
                //     console.error('process_CSSStyleSheet error, reason:', process_result, sheet);
            }
        });
        Array.prototype.forEach.call(
            this.window.document.querySelectorAll(this.style_selector),
            node => {
                if (!this.processed_htmlelements.has(node)) {
                    this.processed_htmlelements.set(node, {
                            last: node.getAttribute('style'),
                            original: node.getAttribute('style')
                        });
                    this.process_HTMLElement_init(node);
                }
            }
        );
        if (no_schedule !== true)
            if (!(this.window.document.hidden) || (this.window.document.readyState !== 'complete'))
                setTimeout(() => this.process(), this.window.document.readyState !== 'complete' ? 100 : 1000);
    }
    static find_ancestor_ownerNode(stylesheet) {
        let { ownerNode, ownerRule } = stylesheet;
        if (ownerNode)
            return ownerNode;
        if (ownerRule)
            return this.find_ancestor_ownerNode(ownerRule.parentStyleSheet);
    }
    async workaround_stylesheet(stylesheet, rel_to) {
        // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1393022
        // TODO: resolve relative urls for CSS properties other than background(-image) and @font-face (cursor, list-style etc.)
        if (this.workaround_requested.has(stylesheet))
            return;
        this.workaround_requested.add(stylesheet);
        let original_url = stylesheet.href;
        let { ownerNode, ownerRule } = stylesheet;

        let url_obj = new URL(stylesheet.href, rel_to);
        let new_url;
        try {
            let css = await (await fetch(url_obj)).text();
            new_url = `data:text/css,${encodeURIComponent(css)}`;
        } catch (e) {
            console.error('inaccessible for fetch() stylesheet', stylesheet);
            this.broken_stylesheets.add(stylesheet);
            return;
        }

        let target_node;
        // reusing original node to preserve order of stylesheets (it matters because cascading depends on it and some websites break if it doesn't preserved)
        if (ownerNode) {
            target_node = ownerNode;
        } else if (ownerRule) {
            // if we make this in place, process_CSSRule iteration below will skip next rule
            setTimeout(() => ownerRule.parentStyleSheet.deleteRule(ownerRule), 0);

            let link = this.window.document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('data-is-imported', 'true');
            link.setAttribute('media', ownerRule.media.mediaText);
            target_node = link;
            let real_owner_node = this.constructor.find_ancestor_ownerNode(stylesheet);
            real_owner_node.parentNode.insertBefore(link, real_owner_node);
        } else
            console.error('something else?', stylesheet);

        target_node.setAttribute('data-original-href', original_url);
        target_node.setAttribute('data-relative-to', url_obj.href);
        target_node.addEventListener('load', () => this.process(true), {once: true});
        target_node.setAttribute('href', new_url);
    }
    process_CSSStyleSheet(CSSStyleSheet_v, base_url) {
        if (this.stop)
            return 'stop';
        if (!base_url) {
            if (CSSStyleSheet_v.ownerNode && CSSStyleSheet_v.ownerNode.hasAttribute('data-relative-to'))
                base_url = CSSStyleSheet_v.ownerNode.getAttribute('data-relative-to');
            else if (CSSStyleSheet_v.href && CSSStyleSheet_v.href.indexOf('data:') !== 0)
                base_url = new URL(CSSStyleSheet_v.href, document.documentURI).href;
            else
                base_url = document.documentURI;
        }
        try {
            if (CSSStyleSheet_v.cssRules === null) // access to .cssRules will throw in Firefox
                throw {name: 'SecurityError'}; // for chrome
        } catch (e) {
            if (e.name === 'SecurityError') {
                this.workaround_stylesheet(CSSStyleSheet_v, base_url).catch(rejection => console.error(rejection));
                return 'bug 1393022';
            }
            else if (e.name === 'InvalidAccessError') {
                // Chromium doesn't create stylesheet object for not loaded stylesheets
                // console.error('stylesheet isn\'t loaded yet. TODO: add watcher?', CSSStyleSheet_v);
                // if (CSSStyleSheet_v.ownerNode)
                //     CSSStyleSheet_v.ownerNode.addEventListener('load', () => this.process(true), {once: true});
                return 'not ready';
            } else
                console.error('something really went wrong!', e, CSSStyleSheet_v);
            return e;
        }
        Array.prototype.forEach.call(CSSStyleSheet_v.cssRules, (rule, index) => {
            this.process_CSSRule(rule, index, base_url);
        });
        return true;
    }
    process_CSSRule(CSSRule_v, index, base_url) {
        if (this.stop)
            return;
        switch (CSSRule_v.type) {
            case 1: // CSSRule.STYLE_RULE
                this.process_CSSStyleRule(CSSRule_v, base_url);
                break;
            case 3: // CSSRule.IMPORT_RULE
                //this.process_CSSImportRule(CSSRule_v);
                this.process_CSSStyleSheet(CSSRule_v.styleSheet, base_url);
                break;
            case 4: // CSSRule.MEDIA_RULE
                //this.process_CSSMediaRule(CSSRule_v);
                this.process_CSSStyleSheet(CSSRule_v, base_url);
                break;
            case 5: // CSSRule.FONT_FACE_RULE
                this.process_CSSFontFaceRule(CSSRule_v, index, base_url);
                break;
        }
    }
    process_CSSFontFaceRule(CSSFontFaceRule_v, index, base_url) {
        let current = CSSFontFaceRule_v;
        let current_index = index;
        if (current.style.getPropertyValue('src')) {
            let parent = current.parentStyleSheet;
            let splitted = brackets_aware_split(current.cssText, ' ');
            splitted = splitted.map(part => {
                if (part.indexOf('url(') === 0) {
                    let url = part.slice(part.indexOf('(') + 1, part.lastIndexOf(')')).trim();
                    if (url.indexOf('"') === 0 && url.lastIndexOf('"') === (url.length - 1))
                        url = url.slice(1, url.length - 1);
                    url = new URL(url, base_url).href;
                    return `url("${url}")`;
                } else
                    return part;
            });
            setTimeout(() => {
                parent.deleteRule(current);
                parent.insertRule(splitted.join(' '), current_index);
            }, 0);
        }
    }
    process_CSSStyleRule(CSSStyleRule_v, base_url) {
        let selector = CSSStyleRule_v.selectorText;
        this.process_CSSStyleDeclaration(
            CSSStyleRule_v.style, // CSSStyleDeclaration
            base_url,
            (selector) ? (selector) : '',
            [], '', ''
        )
    }
    process_HTMLElement_init(HTMLElement_v) {
        this.mutationObserver.observe(
            HTMLElement_v,
            {
                attributes: true,
                attributeFilter: ['style']
            }
        );
        this.process_HTMLElement(HTMLElement_v);
    }
    process_HTMLElement(HTMLElement_v) {
        let old_style = HTMLElement_v.getAttribute('style');
        this.process_CSSStyleDeclaration(
            HTMLElement_v.style,
            this.window.location.href,
            '',
            HTMLElement_v.classList,
            HTMLElement_v.getAttribute('id'),
            HTMLElement_v.tagName
        );
        let new_style = HTMLElement_v.getAttribute('style');
        this.processed_htmlelements.get(HTMLElement_v).last = new_style;

        if (!this.inline_override_selectors) {
            let style_node = this.window.document.createElement('style');
            style_node.setAttribute('id', inline_override_stylesheet_id);
            (this.window.document.querySelector('html > head') || this.window.document.documentElement || this.window.document.childNodes[0] || this.window.document).appendChild(style_node);
            this.inline_override = style_node.sheet;
            this.inline_override_selectors = [];
        }

        let selector = `[style="${old_style.replace(quote_re, '\\"')}"]`;
        if (this.inline_override_selectors.indexOf(selector) < 0) {
            let css_properties = brackets_aware_split(new_style.replace(important_re, ';'), ';').join(' !important; ');
            try {
                this.inline_override.insertRule(`${selector} { ${css_properties} }`, 0);
            } catch (e) {
                console.log(`failed to insert rule: ${selector} { ${css_properties} }\nold style: ${old_style}\nnew style: ${new_style}`);
                console.error(e);
            }
            this.inline_override_selectors.push(selector);
        }
    }
    process_CSSStyleDeclaration(
        CSSStyleDeclaration_v,
        base_url,
        selector,
        classList_v,
        node_id,
        tagname
    ) {
        throw new Error('unimplemented');
    }
}

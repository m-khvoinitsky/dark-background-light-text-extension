"use strict";

var { setTimeout } = require("sdk/timers");
// TODO: http://www.ecma-international.org/ecma-262/6.0/ — very slow
// FIXED: http://www.wsj.com/articles/why-apple-should-kill-off-the-mac-1434321848 — bad colors
// WORKS: http://www.opennet.ru/opennews/art.shtml?num=42453 — bad color, again

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
exports.brackets_aware_split = brackets_aware_split;

const inline_override_stylesheet_id = 'dark-background-light-text-add-on-inline-style-override';
const quote_re = new RegExp('"', 'g');
const important_re = new RegExp('!important;', 'g');

class StylesheetProcessorAbstract {
    constructor(window, options, style_selector) {
        this.window = window;
        this.url = window.document.documentURI;
        this.processed_stylesheets = new WeakMap();
        this.processed_htmlelements = new WeakMap();
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
            Array.prototype.forEach.call(this.window.document.styleSheets, sheet => {
                let { ownerNode } = sheet;
                if (ownerNode.href) {
                    let orighref = ownerNode.href;
                    ownerNode.href = 'about:blank';
                    ownerNode.href = orighref;
                } else if (ownerNode.textContent) {
                    let css = ownerNode.textContent;
                    ownerNode.textContent = '';
                    ownerNode.textContent = css;
                } else {
                    console.log('unhandled stylesheet reload');
                    console.log(ownerNode, ownerNode.tagName);
                }
                // next way works faster, but some race condition exists. TODO: investigate it
                /*parentNode.removeChild(ownerNode);
                 parentNode.appendChild(ownerNode);*/
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
    process() {
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
            if (!this.processed_stylesheets.has(sheet) && sheet !== this.inline_override) {
                if (this.process_CSSStyleSheet(sheet))
                    this.processed_stylesheets.set(sheet, sheet.cssRules.length);
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

        if (!(this.window.document.hidden) || (this.window.document.readyState !== 'complete'))
            setTimeout(() => this.process(), this.window.document.readyState !== 'complete' ? 100 : 1000);
    }
    process_CSSStyleSheet(CSSStyleSheet_v) {
        if (this.stop)
            return false;
        try {
            CSSStyleSheet_v.cssRules;
        } catch (e) {
            // weird shit, but it happens
            // it seems that such stylesheet just not yet ready
            // TODO: will be great to know it exactly
            return false;
        }
        Array.prototype.forEach.call(CSSStyleSheet_v.cssRules, rule => {
            this.process_CSSRule(rule);
        });
        return true;
    }
    process_CSSRule(CSSRule_v) {
        if (this.stop)
            return;
        switch (CSSRule_v.type) {
            case 1: // CSSRule.STYLE_RULE
                this.process_CSSStyleRule(CSSRule_v);
                break;
            case 3: // CSSRule.IMPORT_RULE
                //this.process_CSSImportRule(CSSRule_v);
                this.process_CSSStyleSheet(CSSRule_v.styleSheet);
                break;
            case 4: // CSSRule.MEDIA_RULE
                //this.process_CSSMediaRule(CSSRule_v);
                this.process_CSSStyleSheet(CSSRule_v);
                break;
        }
    }
    process_CSSStyleRule(CSSStyleRule_v) {
        let base_url;
        try {
            base_url = CSSStyleRule_v.parentStyleSheet.href;
        } catch (e) {}
        if (!base_url) //CSSStyleRule_v.parentStyleSheet.ownerNode is HTMLStyleElement, so, it has no href
            base_url = this.window.location.href;
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

exports.StylesheetProcessorAbstract = StylesheetProcessorAbstract;
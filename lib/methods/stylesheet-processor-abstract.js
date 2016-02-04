"use strict";

var { Class } = require('sdk/core/heritage');
let { defer } = require('sdk/lang/functional');
var { setTimeout } = require("sdk/timers");
// TODO: http://www.ecma-international.org/ecma-262/6.0/ — very slow
// FIXED: http://www.wsj.com/articles/why-apple-should-kill-off-the-mac-1434321848 — bad colors
// WORKS: http://www.opennet.ru/opennews/art.shtml?num=42453 — bad color, again
var StylesheetProcessorAbstract = Class({
    initialize: function initialize(window, options) {
        this.window = window;
        this.url = window.document.documentURI;
        this.processed_stylesheets = new WeakMap();
        this.processed_htmlelements = new WeakMap();
        if (!this.style_selector)
            this.style_selector = '[style]';
        this.mutationObserver = new this.window.MutationObserver(records => {
            records.forEach(record => {
                if (record.type != 'attributes')
                    return;
                if (!record.attributeName || record.attributeName != 'style')
                    return;
                if (!record.target)
                    return;

                if (record.target.getAttribute('id') == 'main-window')
                    return;
                if (record.target.getAttribute('id') == 'content')
                    return;
                if (record.target.getAttribute('id') == 'browser-bottombox')
                    return;
                if (record.target.getAttribute('id') == 'identity-box')
                    return;
                let node = record.target;
                //console.log('processing mutated node');
                //console.log(node);
                //console.log(node.getAttribute('style'));
                if (this.processed_htmlelements.get(node).last != node.getAttribute('style')) {
                    //console.log('style has been changed. processing...');
                    this.process_HTMLElement(record.target);
                } else {
                    //console.log('style not changed');
                }
                //
            });
            //console.log(records.length);
        });
        this.options = options;
        this.stop = false;
    },
    load_into_window: function load_into_window(window, options) {
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
    },
    unload_from_window: function unload_from_window(light) {
        this.stop = true;
        this.window.document.removeEventListener('visibilitychange', this.handle_visibilitychange);
        this.mutationObserver.disconnect();
        if (!light) { // "light unloading" (used in case when document is about to be destroyed)
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
    },
    process: function process() {
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
            if (!this.processed_stylesheets.has(sheet)) {
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
    },
    process_CSSStyleSheet: function process_CSSStyleSheet(CSSStyleSheet_v) {
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
    },
    process_CSSRule: function process_CSSRule(CSSRule_v) {
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
    },
    process_CSSStyleRule: function process_CSSStyleRule(CSSStyleRule_v) {
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
    },
    process_HTMLElement_init: function process_HTMLElement_init(HTMLElement_v) {
        this.mutationObserver.observe(
            HTMLElement_v,
            {
                attributes: true,
                attributeFilter: ['style']
            }
        );
        this.process_HTMLElement(HTMLElement_v);
    },
    process_HTMLElement: function process_HTMLElement(HTMLElement_v) {
        this.process_CSSStyleDeclaration(
            HTMLElement_v.style,
            this.window.location.href,
            '',
            HTMLElement_v.classList,
            HTMLElement_v.getAttribute('id'),
            HTMLElement_v.tagName
        );
        this.processed_htmlelements.get(HTMLElement_v).last = HTMLElement_v.getAttribute('style');
    },
    process_CSSStyleDeclaration: function CSSStyleDeclaration(
        CSSStyleDeclaration_v,
        base_url,
        selector,
        classList_v,
        node_id,
        tagname
    ) {
        throw new Error('unimplemented');
    }
});

exports.StylesheetProcessorAbstract = StylesheetProcessorAbstract;
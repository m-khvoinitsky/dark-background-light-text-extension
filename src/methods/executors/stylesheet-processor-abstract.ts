declare var { browser }: typeof import('webextension-polyfill-ts');
import { CallbackID } from '../../common/types';
import AwaitLock from 'await-lock';

const count_char_in_string = (char: string, str: string) => {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
export const inline_fake_selector = '_inline_ykwfjtjiab';
export function brackets_aware_split(value: string, separator: string = ','): string[] {
    // TODO: handle more complex cases
    let result: string[] = [];
    let current: string[] = [];
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

const quote_re = new RegExp('"', 'g');
const important_re = new RegExp('!important;', 'g');
const imported_flag_attribute = 'data-is-imported';

export abstract class StylesheetProcessorAbstract {
    window: Window
    url: string
    processed_stylesheets: WeakMap<StyleSheet, number>
    self_stylesheets: WeakSet<StyleSheet>
    all_initial_sheets_have_been_processed: boolean
    workaround_requested: WeakSet<StyleSheet>
    broken_stylesheets: WeakSet<StyleSheet>
    readonly style_selector: string
    stop: boolean
    handle_visibilitychange?: EventListener
    overridden_inline_styles: Set<string>
    inline_overrides_style: string[]
    auxiliary_element: HTMLElement
    schedule_inline_override_stylesheet_update_timerID: number = 0
    prev_inline_override_stylesheet?: string
    inline_override_lock: AwaitLock
    constructor(window: Window, style_selector: string = '[style]') {
        this.window = window;
        this.url = window.document.documentURI;
        this.processed_stylesheets = new WeakMap();
        this.self_stylesheets = new WeakSet();
        this.all_initial_sheets_have_been_processed = false;
        this.workaround_requested = new WeakSet();
        this.broken_stylesheets = new WeakSet();
        this.style_selector = style_selector;
        this.overridden_inline_styles = new Set();
        this.inline_overrides_style = [];
        this.auxiliary_element = document.createElement('div');
        this.inline_override_lock = new AwaitLock();
        this.stop = false;
    }
    load_into_window() {
        this.process();
        this.handle_visibilitychange = _event => {
            if (this.stop)
                return;
            if (this.window.document.hidden && (this.window.document.readyState === 'complete'))
                return;
            this.process();
        }
        this.window.document.addEventListener('visibilitychange', this.handle_visibilitychange);
        this.window.addEventListener('unload', _event => {
            this.unload_from_window(true);
            //TODO: may be move it to stylesheet-processor.js?
        })
    }
    unload_from_window(light: boolean) {
        this.stop = true;
        if (this.handle_visibilitychange)
            this.window.document.removeEventListener('visibilitychange', this.handle_visibilitychange);
        if (!light) { // "light unloading" (used in case when document is about to be destroyed)
            for (let sheet of this.window.document.styleSheets) {
                let ownerNode = sheet.ownerNode as HTMLElement | null;
                if (!ownerNode) {
                    continue
                }
                if (ownerNode.hasAttribute(imported_flag_attribute)) {
                    this.window.setTimeout(() => {
                        ownerNode!.parentNode?.removeChild(ownerNode!);
                    }, 0);
                } else {
                    let newNode = ownerNode.cloneNode(true);
                    setTimeout(() => {
                        ownerNode!.parentNode?.insertBefore(newNode, ownerNode!.nextSibling);
                        setTimeout(() => {
                            ownerNode!.parentNode?.removeChild(ownerNode!);
                        }, 0);
                    }, 0);
                }
            }
            if (this.prev_inline_override_stylesheet) {
                browser.runtime.sendMessage({
                    action: CallbackID.REMOVE_CSS,
                    code: this.prev_inline_override_stylesheet,
                });
                this.prev_inline_override_stylesheet = undefined;
                this.overridden_inline_styles.clear();
                this.inline_overrides_style.length = 0;
            }
        }
    }
    all_sheets_have_been_processed() {
        this.all_initial_sheets_have_been_processed = true;
    }
    process(no_schedule: boolean = false) {
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

        for (let sheet of this.window.document.styleSheets) {
            if (
                !(
                    this.processed_stylesheets.has(sheet)
                    // Some stylesheets may have already been processed but changed since then.
                    // Checking its cssRules.length should help to detect the majority of such situations.
                    && this.processed_stylesheets.get(sheet) === sheet.cssRules.length
                )
                && !(this.broken_stylesheets.has(sheet))
                && !(this.self_stylesheets.has(sheet))
            ) {
                if (sheet.ownerNode && (sheet.ownerNode as HTMLElement).classList.contains('dblt-ykjmwcnxmi')) {
                    this.self_stylesheets.add(sheet);
                    continue;
                }
                this.process_CSSStyleSheet(sheet);
            }
        }
        if (!this.all_initial_sheets_have_been_processed) {
            if (this.window.document.readyState === 'complete') {
                if (
                    Array.prototype.filter.call(
                        this.window.document.styleSheets,
                        sheet => (
                            !this.processed_stylesheets.has(sheet)
                            && !this.broken_stylesheets.has(sheet)
                            && !this.self_stylesheets.has(sheet)
                        )
                    ).length === 0
                ) {
                    this.all_sheets_have_been_processed();
                } else {
                    this.window.setTimeout(this.all_sheets_have_been_processed, 2000);
                }
            } else {
                this.window.setTimeout(this.all_sheets_have_been_processed, 10000);
            }
        }
        for (let node of this.window.document.querySelectorAll(this.style_selector)) {
            this.process_HTMLElement(node as HTMLElement);
        }
        if (no_schedule !== true) {
            if (
                !(this.window.document.hidden)
                || (this.window.document.readyState !== 'complete')
            ) {
                setTimeout(
                    () => this.process(),
                    this.window.document.readyState !== 'complete' ? 100 : 1000
                );
            }
        }
    }
    static find_ancestor_ownerNode(stylesheet: CSSStyleSheet): Element | undefined {
        let { ownerNode, ownerRule } = stylesheet as {
            ownerNode: HTMLElement | null,
            ownerRule: CSSImportRule | null,
        };
        if (ownerNode) {
            return ownerNode;
        }
        if (ownerRule) {
            return this.find_ancestor_ownerNode(
                ownerRule.parentStyleSheet ?? stylesheet.parentStyleSheet!
            ); // #169
        }
        return
    }
    workaround_stylesheet(stylesheet: CSSStyleSheet, rel_to: string) {
        // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1393022
        if (this.workaround_requested.has(stylesheet)) {
            return
        }
        this.workaround_requested.add(stylesheet);
        let {
            ownerNode,
            ownerRule,
        } = stylesheet as {
            ownerNode: HTMLElement | null,
            ownerRule: CSSImportRule | null,
        };
        if (ownerNode) {
            if (!(ownerNode instanceof HTMLLinkElement)) {
                console.error('ownerNode is not instanceof HTMLLinkElement', ownerNode);
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            if (
                ownerNode.hasAttribute('crossorigin')
                && [
                    'anonymous',
                    'use-credentials',
                    '',
                ].indexOf(ownerNode.getAttribute('crossorigin')!) >= 0
            ) {
                console.error('ownerNode already has crossorigin attribute but the stylesheet is still unaccessable')
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            let href = ownerNode.getAttribute('href');
            if (!href) {
                console.error('ownerNode does not have href');
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            if (['https:', 'http:'].indexOf((new URL(href, window.document.documentURI)).protocol) < 0) {
                // console.error('ownerNode href is not http(s), refusing to add crossorigin attribute');
                // this is fine, usually happens in chrome pages where content scripts are still allowed, for example, plain image or video view
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            let newNode = ownerNode.cloneNode() as HTMLLinkElement;
            newNode.setAttribute('crossorigin', 'anonymous');
            newNode.addEventListener('load', () => this.process(true), {once: true});
            this.window.setTimeout(() => ownerNode!.parentNode?.removeChild(ownerNode!), 0);
            ownerNode.parentNode?.insertBefore(newNode, ownerNode.nextSibling);
        } else if (ownerRule) {
            let url_obj = new URL(stylesheet.href || ownerRule.href, rel_to);

            if (ownerRule.parentStyleSheet) { // #169
                setTimeout(() => (ownerRule!.parentStyleSheet!).deleteRule(
                    Array.prototype.indexOf.call((ownerRule!.parentStyleSheet!).cssRules, ownerRule)
                ), 0);
            } else {
                setTimeout(() => stylesheet.parentStyleSheet!.deleteRule(
                    Array.prototype.indexOf.call(stylesheet.parentStyleSheet!.cssRules, ownerRule)
                ), 0); // #169
            }

            let link = this.window.document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('crossorigin', 'anonymous');
            link.setAttribute(imported_flag_attribute, 'true');
            try {
                link.setAttribute('media', ownerRule.media.mediaText);
            } catch (e) {
                // no idea what's going on
                console.error(e, ownerRule);
            }
            let real_owner_node = StylesheetProcessorAbstract.find_ancestor_ownerNode(stylesheet);
            real_owner_node!.parentNode!.insertBefore(link, real_owner_node!);

            link.addEventListener('load', () => this.process(true), {once: true});
            link.setAttribute('href', url_obj.href);
        } else {
            console.error('None of ownerNode and ownerRule is defined in stylesheet. This should never happen.', stylesheet);
            return
        }
    }
    process_CSSStyleSheet(CSSStyleSheet_v: CSSStyleSheet, base_url?: string) {
        if (this.stop)
            return 'stop';
        if (!base_url) {
            if (CSSStyleSheet_v.href && CSSStyleSheet_v.href.indexOf('data:') !== 0) {
                base_url = new URL(CSSStyleSheet_v.href, document.documentURI).href;
            } else {
                base_url = document.documentURI;
            }
        }
        try {
            if (CSSStyleSheet_v.cssRules === null) // access to .cssRules will throw in Firefox
                throw {name: 'SecurityError'}; // for chrome
        } catch (e) {
            if (e.name === 'SecurityError') {
                this.workaround_stylesheet(CSSStyleSheet_v, base_url);
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
        Array.prototype.forEach.call(CSSStyleSheet_v.cssRules, (rule) => {
            this.process_CSSRule(rule, base_url!);
        });
        this.processed_stylesheets.set(CSSStyleSheet_v, CSSStyleSheet_v.cssRules.length);
        return true;
    }
    process_CSSGroupingRule(CSSGroupingRule_v: CSSGroupingRule, base_url: string) {
        Array.prototype.forEach.call(CSSGroupingRule_v.cssRules, (rule) => {
            this.process_CSSRule(rule, base_url);
        });
    }
    process_CSSRule(CSSRule_v: CSSRule, base_url: string) {
        if (this.stop)
            return;
        switch (CSSRule_v.type) {
            case 1: // CSSRule.STYLE_RULE
                this.process_CSSStyleRule(CSSRule_v as CSSStyleRule, base_url);
                break;
            case 3: // CSSRule.IMPORT_RULE
                //this.process_CSSImportRule(CSSRule_v);
                this.process_CSSStyleSheet((CSSRule_v as CSSImportRule).styleSheet, base_url);
                break;
            case 4: // CSSRule.MEDIA_RULE
                this.process_CSSGroupingRule(CSSRule_v as CSSMediaRule, base_url);
                break;
            case 12: // CSSRule.SUPPORTS_RULE
                this.process_CSSGroupingRule(CSSRule_v as CSSSupportsRule, base_url);
                break;
        }
    }
    process_CSSStyleRule(CSSStyleRule_v: CSSStyleRule, base_url: string) {
        let selector = CSSStyleRule_v.selectorText;
        this.process_CSSStyleDeclaration(
            CSSStyleRule_v.style, // CSSStyleDeclaration
            base_url,
            (selector) ? (selector) : '',
            [], '', ''
        )
    }
    async inline_override_stylesheet_update() {
        await this.inline_override_lock.acquireAsync();
        try {
            let css = this.inline_overrides_style.join('\n');
            await browser.runtime.sendMessage({
                action: CallbackID.INSERT_CSS,
                code: css,
            });
            if (this.prev_inline_override_stylesheet) {
                await browser.runtime.sendMessage({
                    action: CallbackID.REMOVE_CSS,
                    code: this.prev_inline_override_stylesheet,
                });
            }
            this.prev_inline_override_stylesheet = css;
        } finally {
            this.inline_override_lock.release();
        }
    }
    schedule_inline_override_stylesheet_update(): void {
        window.clearTimeout(this.schedule_inline_override_stylesheet_update_timerID)
        this.schedule_inline_override_stylesheet_update_timerID = window.setTimeout(
            () => this.inline_override_stylesheet_update(),
            100,
        );
    }
    process_HTMLElement(HTMLElement_v: HTMLElement): void {
        let old_style = HTMLElement_v.getAttribute('style');
        if (!old_style || this.overridden_inline_styles.has(old_style)) {
            return;
        }

        this.auxiliary_element.setAttribute('style', old_style);
        this.process_CSSStyleDeclaration(
            this.auxiliary_element.style,
            this.window.location.href,
            inline_fake_selector,
            [...HTMLElement_v.classList],
            HTMLElement_v.getAttribute('id'),
            HTMLElement_v.tagName,
        );
        let new_style = this.auxiliary_element.getAttribute('style')!;
        if (new_style === old_style) {
            this.overridden_inline_styles.add(old_style);
            return
        }
        let new_style_important = brackets_aware_split(new_style.replace(important_re, ';'), ';').join(' !important; ');
        let selector = `[style="${old_style.replace(quote_re, '\\"')}"]`;
        let cssrule = `${selector} { ${new_style_important} }`;
        this.overridden_inline_styles.add(old_style);
        this.inline_overrides_style.push(cssrule);
        this.schedule_inline_override_stylesheet_update();
    }
    abstract process_CSSStyleDeclaration(
        CSSStyleDeclaration_v: CSSStyleDeclaration,
        base_url: string,
        selector: string,
        classList_v: string[],
        node_id: string | null,
        tagname: string,
    ): void
}

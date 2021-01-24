declare var { browser }: typeof import('webextension-polyfill-ts');
import { CallbackID } from '../../common/types';
import AwaitLock from 'await-lock';

const count_char_in_string = (char: string, str: string) => {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
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
            let ownerNodes = Array.prototype.map.call(this.window.document.styleSheets, (sheet: StyleSheet) => sheet.ownerNode) as Element[];
            ownerNodes.forEach((ownerNode: Element) => {
                if (ownerNode.hasAttribute('data-is-imported')) {
                    ownerNode.parentNode?.removeChild(ownerNode);
                } else {
                    let parentNode = ownerNode.parentNode;
                    let insertBefore = ownerNode.nextSibling;
                    parentNode?.removeChild(ownerNode);
                    if (ownerNode.hasAttribute('data-original-href')) {
                        ownerNode.setAttribute('href', ownerNode.getAttribute('data-original-href') as string);
                        ownerNode.removeAttribute('data-original-href');
                    }
                    if (ownerNode.hasAttribute('data-relative-to')) {
                        ownerNode.removeAttribute('data-relative-to');
                    }
                    parentNode?.insertBefore(ownerNode, insertBefore);
                }
            });
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

        Array.prototype.forEach.call(this.window.document.styleSheets, sheet => {
            if (
                !(
                    this.processed_stylesheets.has(sheet)
                    // Some stylesheets may have already been processed but changed since then.
                    // Checking its cssRules.length should help to detect the majority of such situations.
                    && this.processed_stylesheets.get(sheet) === sheet.cssRules.length
                )
                && !this.broken_stylesheets.has(sheet)
                && !this.self_stylesheets.has(sheet)
            ) {
                if (sheet.ownerNode && sheet.ownerNode.classList.contains('dblt-ykjmwcnxmi')) {
                    this.self_stylesheets.add(sheet);
                    return;
                }
                let process_result = this.process_CSSStyleSheet(sheet);
                if (process_result === true)
                    this.processed_stylesheets.set(sheet, sheet.cssRules.length);
                // else
                //     console.error('process_CSSStyleSheet error, reason:', process_result, sheet);
            }
        });
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
    static find_ancestor_ownerNode(stylesheet: CSSStyleSheet): Node | undefined {
        let { ownerNode, ownerRule } = stylesheet;
        if (stylesheet.ownerNode)
            return ownerNode!;
        if (ownerRule)
            if (ownerRule.parentStyleSheet) // #169
                return this.find_ancestor_ownerNode(ownerRule.parentStyleSheet);
            else
                return this.find_ancestor_ownerNode(stylesheet.parentStyleSheet as CSSStyleSheet); // #169
        return
    }
    async workaround_stylesheet(stylesheet: CSSStyleSheet, rel_to: string) {
        // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1393022
        // TODO: resolve relative urls for CSS properties other than background(-image) and @font-face (cursor, list-style etc.)
        if (this.workaround_requested.has(stylesheet))
            return;
        this.workaround_requested.add(stylesheet);
        let { ownerNode, ownerRule } = stylesheet;
        let original_url = stylesheet.href !== 'about:invalid' ? stylesheet.href as string : (ownerRule as CSSImportRule).href;

        let url_obj = new URL(original_url, rel_to);
        let new_url;
        try {
            let css = await (await fetch(url_obj.href)).text();
            new_url = `data:text/css,${encodeURIComponent(css)}`;
        } catch (e) {
            console.error('inaccessible for fetch() stylesheet', stylesheet);
            this.broken_stylesheets.add(stylesheet);
            return;
        }

        let target_node: Element;
        // reusing original node to preserve order of stylesheets (it matters because cascading depends on it and some websites break if it doesn't preserved)
        if (ownerNode) {
            target_node = ownerNode as Element;
        } else if (ownerRule) {
            // if we make this in place, process_CSSRule iteration below will skip next rule
            if (ownerRule.parentStyleSheet) // #169
                setTimeout(() => ((ownerRule as CSSImportRule).parentStyleSheet!).deleteRule(
                    Array.prototype.indexOf.call(((ownerRule as CSSImportRule).parentStyleSheet!).cssRules, ownerRule!)
                ), 0);
            else
                setTimeout(() => (stylesheet.parentStyleSheet as CSSStyleSheet).deleteRule(
                    Array.prototype.indexOf.call((stylesheet.parentStyleSheet as CSSStyleSheet).cssRules, ownerRule!)
                ), 0); // #169

            let link = this.window.document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('data-is-imported', 'true');
            try {
                link.setAttribute('media', (ownerRule as CSSMediaRule).media.mediaText);
            } catch (e) {
                // no idea what's going on
                console.error(e, ownerRule);
            }
            target_node = link;
            let real_owner_node = StylesheetProcessorAbstract.find_ancestor_ownerNode(stylesheet);
            real_owner_node!.parentNode!.insertBefore(link, real_owner_node!);
        } else {
            console.error('something else?', stylesheet);
            return
        }

        target_node.setAttribute('data-original-href', original_url);
        target_node.setAttribute('data-relative-to', url_obj.href);
        target_node.addEventListener('load', () => this.process(true), {once: true});
        target_node.setAttribute('href', new_url);
    }
    process_CSSStyleSheet(CSSStyleSheet_v: CSSStyleSheet, base_url?: string) {
        if (this.stop)
            return 'stop';
        if (!base_url) {
            if (CSSStyleSheet_v.ownerNode && (CSSStyleSheet_v.ownerNode as Element).hasAttribute('data-relative-to'))
                base_url = (CSSStyleSheet_v.ownerNode as Element).getAttribute('data-relative-to')!;
            else if (CSSStyleSheet_v.href && CSSStyleSheet_v.href.indexOf('data:') !== 0)
                base_url = new URL(CSSStyleSheet_v.href, document.documentURI).href;
            else
                base_url = document.documentURI;
        }
        try {
            if (CSSStyleSheet_v.cssRules === null) // access to .cssRules will throw in Firefox
                throw {name: 'SecurityError'}; // for chrome
            else if (CSSStyleSheet_v.href === 'about:invalid')
                // happens with relative @import rules inside workarounded stylesheets
                throw {name: 'SecurityError'};
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
            this.process_CSSRule(rule, index, base_url!);
        });
        return true;
    }
    process_CSSGroupingRule(CSSGroupingRule_v: CSSGroupingRule, base_url: string) {
        Array.prototype.forEach.call(CSSGroupingRule_v.cssRules, (rule, index) => {
            this.process_CSSRule(rule, index, base_url);
        });
    }
    process_CSSRule(CSSRule_v: CSSRule, index: number, base_url: string) {
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
            case 5: // CSSRule.FONT_FACE_RULE
                this.process_CSSFontFaceRule(CSSRule_v as CSSFontFaceRule, index, base_url);
                break;
            case 12: // CSSRule.SUPPORTS_RULE
                this.process_CSSGroupingRule(CSSRule_v as CSSSupportsRule, base_url);
                break;
        }
    }
    process_CSSFontFaceRule(CSSFontFaceRule_v: CSSFontFaceRule, index: number, base_url: string) {
        if (CSSFontFaceRule_v.style.getPropertyValue('src')) {
            let parent = CSSFontFaceRule_v.parentStyleSheet!;
            let owner_node = StylesheetProcessorAbstract.find_ancestor_ownerNode(parent);
            if (!(owner_node as Element).hasAttribute('data-relative-to'))
                return;
            let splitted = brackets_aware_split(CSSFontFaceRule_v.cssText, ' ');
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
                parent.deleteRule(index);
                parent.insertRule(splitted.join(' '), index);
            }, 0);
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
            '',
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

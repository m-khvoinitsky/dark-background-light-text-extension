import AwaitLock from 'await-lock';
import { CallbackID } from '../../common/types';

declare const { browser }: typeof import('webextension-polyfill-ts');
declare const { exportFunction }: typeof import('../../types/exportFunction');
// ensure browser version of setTimeout
declare const setTimeout: typeof window.setTimeout;


function count_char_in_string(char: string, str: string) {
    let count = 0;
    for (let index = 0; index < str.length; index++) {
        count += (str[index] === char) ? 1 : 0;
    }
    return count;
}
export const inline_fake_selector = '_inline_ykwfjtjiab';
export function brackets_aware_split(value: string, separator: string = ','): string[] {
    // TODO: handle more complex cases
    const result: string[] = [];
    let current: string[] = [];
    let depth = 0;
    const splitted = value.split(separator);
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
}

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
    shadow_roots: Array<WeakRef<ShadowRoot>> = [];
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

        // WeakRef is not yet supported in ESR (<79) so Shadow DOM processing won't work there
        if ('WeakRef' in window) {
            const shadow_roots = this.shadow_roots;
            const attachShadowReal = Element.prototype.attachShadow;

            // eslint-disable-next-line no-inner-declarations
            function attachShadow(this: Element, init: ShadowRootInit) {
                const root = attachShadowReal.call(this, init);
                shadow_roots.push(new WeakRef(root));
                return root;
            }
            exportFunction(
                attachShadow,
                Element.prototype,
                {
                    defineAs: 'attachShadow',
                },
            );
        }
    }

    load_into_window() {
        this.process();
        this.handle_visibilitychange = (_event) => {
            if (this.stop) {
                return;
            }
            if (this.window.document.hidden && (this.window.document.readyState === 'complete')) {
                return;
            }
            this.process();
        };
        this.window.document.addEventListener('visibilitychange', this.handle_visibilitychange);
        this.window.addEventListener('unload', (_event) => {
            this.unload_from_window(true);
            // TODO: may be move it to stylesheet-processor.js?
        });
    }

    unload_from_window(light: boolean) {
        this.stop = true;
        if (this.handle_visibilitychange) {
            this.window.document.removeEventListener('visibilitychange', this.handle_visibilitychange);
        }
        if (!light) { // "light unloading" (used in case when document is about to be destroyed)
            for (const sheet of this.window.document.styleSheets) {
                const ownerNode = sheet.ownerNode as HTMLElement | null;
                if (!ownerNode) {
                    continue;
                }
                if (ownerNode.hasAttribute(imported_flag_attribute)) {
                    setTimeout(() => {
                        ownerNode!.parentNode?.removeChild(ownerNode!);
                    }, 0);
                } else {
                    const newNode = ownerNode.cloneNode(true);
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
        // TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=839103
        //
        if (this.stop) {
            return;
        }

        /* if ((!('changed' in this)) && this.url != this.window.document.documentURI) {
            // TODO: investigate it more deeply
            console.log(
                'document url changed',
                {
                    old_url: this.url,
                    new_url: this.window.document.documentURI,
                    new_href: this.window.location.href,
                },
            );
            this.changed = true;
            console.log('stopping work, bad doc', this.url, this.window.document.documentURI);
            this.stop = true;
            return;
        } */

        for (let i = this.shadow_roots.length - 1; i >= 0; i--) {
            /*
              Using WeakRef for filtering out dead shadowRoots isn't super reliable - they are
              garbage collected despite still being part of the DOM. Another approach would be
              checking document.contains(shadow.host), however this would return false if host
              hasn't yet been added to the DOM (which happens almost all the time on the first
              iteration), so WeakRefs are much more reliable.
             */
            const shadow = this.shadow_roots[i].deref();
            if (shadow === undefined) {
                this.shadow_roots.splice(i, 1);
                continue;
            }
            for (const sheet of shadow.styleSheets) {
                this.process_CSSStyleSheet(sheet);
            }
        }
        for (const sheet of this.window.document.styleSheets) {
            this.process_CSSStyleSheet(sheet);
        }
        if (!this.all_initial_sheets_have_been_processed) {
            if (this.window.document.readyState === 'complete') {
                if (Array.prototype.every.call(
                    this.window.document.styleSheets,
                    (sheet) => (
                        this.processed_stylesheets.has(sheet)
                        || this.broken_stylesheets.has(sheet)
                        || this.self_stylesheets.has(sheet)
                    ),
                )) {
                    this.all_sheets_have_been_processed();
                } else {
                    setTimeout(this.all_sheets_have_been_processed, 2000);
                }
            } else {
                setTimeout(this.all_sheets_have_been_processed, 10000);
            }
        }
        for (const node of this.window.document.querySelectorAll(this.style_selector)) {
            this.process_HTMLElement(node as HTMLElement);
        }
        if (no_schedule !== true) {
            if (
                !(this.window.document.hidden)
                || (this.window.document.readyState !== 'complete')
            ) {
                setTimeout(
                    () => this.process(),
                    this.window.document.readyState !== 'complete' ? 100 : 1000,
                );
            }
        }
    }

    static find_ancestor_ownerNode(stylesheet: CSSStyleSheet): Element | undefined {
        const { ownerNode, ownerRule } = stylesheet as {
            ownerNode: HTMLElement | null,
            ownerRule: CSSImportRule | null,
        };
        if (ownerNode) {
            return ownerNode;
        }
        if (ownerRule) {
            return this.find_ancestor_ownerNode(
                ownerRule.parentStyleSheet ?? stylesheet.parentStyleSheet!,
            ); // #169
        }
        // eslint-disable-next-line no-useless-return
        return;
    }

    workaround_stylesheet(stylesheet: CSSStyleSheet, rel_to: string) {
        // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1393022
        if (this.workaround_requested.has(stylesheet)) {
            return;
        }
        this.workaround_requested.add(stylesheet);
        const {
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
                console.error('ownerNode already has crossorigin attribute but the stylesheet is still unaccessable');
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            const href = ownerNode.getAttribute('href');
            if (!href) {
                console.error('ownerNode does not have href');
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            if (['https:', 'http:'].indexOf((new URL(href, window.document.documentURI)).protocol) < 0) {
                // console.error(
                //     'ownerNode href is not http(s), refusing to add crossorigin attribute',
                // );
                // this is fine, usually happens in chrome pages where content scripts
                // are still allowed, for example, plain image or video view
                this.broken_stylesheets.add(stylesheet);
                return;
            }
            const newNode = ownerNode.cloneNode() as HTMLLinkElement;
            newNode.setAttribute('crossorigin', 'anonymous');
            newNode.addEventListener('load', () => this.process(true), { once: true });
            setTimeout(() => ownerNode!.parentNode?.removeChild(ownerNode!), 0);
            ownerNode.parentNode?.insertBefore(newNode, ownerNode.nextSibling);
        } else if (ownerRule) {
            const url_obj = new URL(stylesheet.href || ownerRule.href, rel_to);

            if (ownerRule.parentStyleSheet) { // #169
                setTimeout(() => (ownerRule!.parentStyleSheet!).deleteRule(
                    Array.prototype.indexOf.call(
                        (ownerRule!.parentStyleSheet!).cssRules,
                        ownerRule,
                    ),
                ), 0);
            } else {
                setTimeout(() => stylesheet.parentStyleSheet!.deleteRule(
                    Array.prototype.indexOf.call(
                        stylesheet.parentStyleSheet!.cssRules,
                        ownerRule,
                    ),
                ), 0); // #169
            }

            const link = this.window.document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('crossorigin', 'anonymous');
            link.setAttribute(imported_flag_attribute, 'true');
            try {
                link.setAttribute('media', ownerRule.media.mediaText);
            } catch (e) {
                // no idea what's going on
                console.error(e, ownerRule);
            }
            const real_owner_node = StylesheetProcessorAbstract.find_ancestor_ownerNode(stylesheet);
            real_owner_node!.parentNode!.insertBefore(link, real_owner_node!);

            link.addEventListener('load', () => this.process(true), { once: true });
            link.setAttribute('href', url_obj.href);
        } else {
            console.error('None of ownerNode and ownerRule is defined in stylesheet. This should never happen.', stylesheet);
            return;
        }
    }

    process_CSSStyleSheet(sheet: CSSStyleSheet, base_url?: string) {
        if (this.stop) {
            return 'stop';
        }

        if (
            (
                this.processed_stylesheets.has(sheet)
                // Some stylesheets may have already been processed but changed since then.
                // Checking its cssRules.length should help to detect
                // the majority of such situations.
                // Note: checking `...get(sheet) === sheet.cssRules.length` could be enough,
                // however, sheet.cssRules may throw (handled below) so we have to check first
                // if ...has(sheet) which means it has been processed and cssRules won't throw
                && this.processed_stylesheets.get(sheet) === sheet.cssRules.length
            )
            || this.broken_stylesheets.has(sheet)
            || this.self_stylesheets.has(sheet)
        ) {
            return;
        }

        if ((sheet.ownerNode as HTMLElement | null)?.classList.contains('dblt-ykjmwcnxmi')) {
            this.self_stylesheets.add(sheet);
            return;
        }

        if (!base_url) {
            if (sheet.href && !sheet.href.startsWith('data:')) {
                // eslint-disable-next-line no-param-reassign
                base_url = new URL(sheet.href, document.documentURI).href;
            } else {
                // eslint-disable-next-line no-param-reassign
                base_url = document.documentURI;
            }
        }
        try {
            if (sheet.cssRules === null) { // access to .cssRules will throw in Firefox
                // eslint-disable-next-line no-throw-literal
                throw { name: 'SecurityError' }; // for chrome
            }
        } catch (e) {
            if (e.name === 'SecurityError') {
                this.workaround_stylesheet(sheet, base_url);
                return 'bug 1393022';
            } else if (e.name === 'InvalidAccessError') {
                // Chromium doesn't create stylesheet object for not loaded stylesheets
                // console.error('stylesheet isn\'t loaded yet. TODO: add watcher?', sheet);
                // if (sheet.ownerNode) {
                //     sheet.ownerNode.addEventListener(
                //         'load',
                //         () => this.process(true),
                //         { once: true },
                //     );
                // }
                return 'not ready';
            } else {
                console.error('something really went wrong!', e, sheet);
            }
            return e;
        }
        Array.prototype.forEach.call(sheet.cssRules, (rule) => {
            this.process_CSSRule(rule, base_url!);
        });
        this.processed_stylesheets.set(sheet, sheet.cssRules.length);
        return true;
    }

    process_CSSGroupingRule(CSSGroupingRule_v: CSSGroupingRule, base_url: string) {
        Array.prototype.forEach.call(CSSGroupingRule_v.cssRules, (rule) => {
            this.process_CSSRule(rule, base_url);
        });
    }

    process_CSSRule(CSSRule_v: CSSRule, base_url: string) {
        if (this.stop) {
            return;
        }
        // eslint-disable-next-line default-case
        switch (CSSRule_v.type) {
            case 1: // CSSRule.STYLE_RULE
                this.process_CSSStyleRule(CSSRule_v as CSSStyleRule, base_url);
                break;
            case 3: // CSSRule.IMPORT_RULE
                // this.process_CSSImportRule(CSSRule_v);
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
        const selector = CSSStyleRule_v.selectorText;
        this.process_CSSStyleDeclaration(
            CSSStyleRule_v.style, // CSSStyleDeclaration
            base_url,
            selector || '',
            [], '', '',
        );
    }

    async inline_override_stylesheet_update() {
        await this.inline_override_lock.acquireAsync();
        try {
            const css = this.inline_overrides_style.join('\n');
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
        clearTimeout(this.schedule_inline_override_stylesheet_update_timerID);
        this.schedule_inline_override_stylesheet_update_timerID = setTimeout(
            () => this.inline_override_stylesheet_update(),
            100,
        );
    }

    process_HTMLElement(HTMLElement_v: HTMLElement): void {
        const old_style = HTMLElement_v.getAttribute('style');
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
        const new_style = this.auxiliary_element.getAttribute('style')!;
        if (new_style === old_style) {
            this.overridden_inline_styles.add(old_style);
            return;
        }
        const new_style_important = brackets_aware_split(new_style.replace(important_re, ';'), ';').join(' !important; ');
        const selector = `[style="${old_style.replace(quote_re, '\\"')}"]`;
        const cssrule = `${selector} { ${new_style_important} }`;
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

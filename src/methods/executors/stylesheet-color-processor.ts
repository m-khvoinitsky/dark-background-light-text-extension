import { parseCSSColor } from 'csscolorparser-ts';
import {
    AddonOptions,
    MethodExecutor,
    RGBA,
    DefaultColors,
} from '../../common/types';
import {
    relative_luminance,
    lighten_or_darken_color,
    strip_alpha,
} from '../../common/color_utils';
import {
    StylesheetProcessorAbstract,
    brackets_aware_split,
    inline_fake_selector,
} from './stylesheet-processor-abstract';


function parse_text_shadow(value: string): [null, null] | [Array<string | RGBA>, number] {
    let color_index;
    const splitted = brackets_aware_split(value, ' ') as Array<string | RGBA>;
    for (let i = 0; i < splitted.length; i++) {
        const parsed_color = parseCSSColor(splitted[i] as string);
        if (parsed_color) {
            color_index = i;
            splitted[i] = parsed_color;
            break;
        }
    }
    if (typeof color_index === 'undefined') {
        return [null, null];
    }
    return [splitted, color_index];
}

const intersect = (set1: string[], set2: string[]): boolean => set1.some(
    (set1_cur) => set2.some(
        (set2_cur) => ( // TODO: remove redundant .toLowerCase()
            (set1_cur && set2_cur.toLowerCase().indexOf(set1_cur.toLowerCase()) >= 0)
            || (set2_cur && set1_cur.toLowerCase().indexOf(set2_cur.toLowerCase()) >= 0)
        ),
    ),
);

const preserve_background_color: string[] = [
    // Youtube
    '.ytp-menuitem-toggle-checkbox',
    '.ytp-volume-slider',
    '.ytp-hover-progress',
    '.ytp-load-progress',
    '.ytp-progress-list',
    '.paper-toggle-button',
    '.barchart', // sentry charts
];

const remove_background_image: string[] = [
    'media.mongodb.org/code-block-bg.png',
    /* 'static/cm-bkg.jpg',  //http://review.cyanogenmod.org/
     'images/homepagetop.gif',  //http://trv-science.ru/
     'images/homepagetoptop.gif',
     'images/sidebartop.gif',
     'images/leftsidebartop.gif',
     'images/rightsidebartop.gif',
     'images/bottom.gif' */ // removed due to "remove bg-image if no-repeat too"
];

const do_not_remove_background_image: string[] = [
    'a.add', // test
    'favorite.gif', // habrahabr.ru
    'pageviews.png',
    'bg-user2.gif',
    'bg-author-link.gif',
    'bg-comments2.gif', // /habrahabr.ru
    'button',
    'btn',
    'icon',
    'logo',
    'stars',
    'sprites',
    'sprite',
    // 'menu',
    'Menu',
    's.ytimg.com',
    'toggle',
    'toolbar',
    'progress',
    'face',
    '.svg',
    'image/svg',
    '/rsrc.php/', // facebook sprites/icons
    '.i-tip', // http://catalog.onliner.by
    '.dijitCheckBox', // at least tt-rss checkboxes
    'checkbox',
    '.current-rating', // https://play.google.com/store/apps/ rating stars
    'chrome://wot/', // Web of Trust icons are invisible #13
    '.ytp-gradient-top',     // #70
    '.ytp-gradient-bottom',  // #70
    'thumbnail',
    'tooltip', // ytp-tooltip-bg class
    'avatar',
    'browserref', // https://www.w3schools.com/
];

const system_colors: string[] = [
    // https://developer.mozilla.org/en/docs/Web/CSS/color_value#System_Colors
    'ActiveText',
    'ButtonFace',
    'ButtonText',
    'Canvas',
    'CanvasText',
    'Field',
    'FieldText',
    'GrayText',
    'Highlight',
    'HighlightText',
    'LinkText',
    'VisitedText',
    // Deprecated system color keywords
    'ActiveBorder',
    'ActiveCaption',
    'AppWorkspace',
    'Background',
    'ButtonHighlight',
    'ButtonShadow',
    'CaptionText',
    'InactiveBorder',
    'InactiveCaption',
    'InactiveCaptionText',
    'InfoBackground',
    'InfoText',
    'Menu',
    'MenuText',
    'Scrollbar',
    'ThreeDDarkShadow',
    'ThreeDFace',
    'ThreeDHighlight',
    'ThreeDLightShadow',
    'ThreeDShadow',
    'Window',
    'WindowFrame',
    'WindowText',
].map((c) => c.toLowerCase());

export class StylesheetColorProcessor
    extends StylesheetProcessorAbstract
    implements MethodExecutor {
    options: AddonOptions
    backgroundify_color: (color_array: RGBA) => string
    foregroundify_color: (color_array: RGBA) => string
    readonly var_name_postfix = '-dark-background-light-text-add-on-'
    readonly rename_var_fg = (var_name: string) => `${var_name}${this.var_name_postfix}fg`
    readonly rename_var_bg = (var_name: string) => `${var_name}${this.var_name_postfix}bg`
    // eslint-disable-next-line max-len
    readonly use_webkit_text_stroke = false // window.CSS.supports('-webkit-text-stroke', '1px red');
    constructor(window: Window, options: AddonOptions) {
        super(window, '[style*="color"], [style*="background"]');
        this.options = options;
        const default_foreground_color = parseCSSColor(this.options.default_foreground_color)!;
        const default_background_color = parseCSSColor(this.options.default_background_color)!;
        const is_dark_background = (
            relative_luminance(strip_alpha(default_background_color))
            < relative_luminance(strip_alpha(default_foreground_color))
        );
        const default_colors: DefaultColors = (
            is_dark_background
                ? {
                    default_light_color: default_foreground_color,
                    default_dark_color: default_background_color,
                }
                : {
                    default_light_color: default_background_color,
                    default_dark_color: default_foreground_color,
                }
        );
        this.backgroundify_color = (color_array) => lighten_or_darken_color(
            color_array,
            is_dark_background,
            default_colors,
        );
        this.foregroundify_color = (color_array) => lighten_or_darken_color(
            color_array,
            !is_dark_background,
            default_colors,
        );
    }

    unload_from_window() {
        StylesheetProcessorAbstract.prototype.unload_from_window.call(this, false);
    }

    all_sheets_have_been_processed() { // TODO: remove hardcoded "simple-css"
        const nodes = document.querySelectorAll('style[data-source="simple-css"]');
        for (const node of nodes) {
            node.parentElement?.removeChild(node);
        }
        super.all_sheets_have_been_processed();
    }

    // CSS2Properties
    process_CSSStyleDeclaration(
        CSSStyleDeclaration_v: CSSStyleDeclaration,
        base_url: string,
        selector: string,
        // @ts-ignore: 6133
        classList_v: string[],
        // @ts-ignore: 6133
        node_id: string | null,
        // @ts-ignore: 6133
        tagname: string,
    ): void {
        const var_properties = [];
        for (const p of CSSStyleDeclaration_v) {
            if (p.indexOf('--') === 0 && p.indexOf(this.var_name_postfix) < 0) {
                var_properties.push(p);
            }
        }
        for (const p of var_properties) {
            CSSStyleDeclaration_v.setProperty(
                this.rename_var_fg(p),
                this.process_color_property(
                    CSSStyleDeclaration_v.getPropertyValue(p),
                    true,
                    false,
                )!,
                CSSStyleDeclaration_v.getPropertyPriority(p),
            );
            CSSStyleDeclaration_v.setProperty(
                this.rename_var_bg(p),
                this.process_background_property(
                    CSSStyleDeclaration_v.getPropertyValue(p),
                    selector,
                    base_url,
                ),
                CSSStyleDeclaration_v.getPropertyPriority(p),
            );
        }

        const color = CSSStyleDeclaration_v.getPropertyValue('color');
        // data from shorthand 'background' property available
        // in bg-color and bg-image but only if it isn't var(...)
        const background = CSSStyleDeclaration_v.getPropertyValue('background');
        const background_color = CSSStyleDeclaration_v.getPropertyValue('background-color');
        const background_image = CSSStyleDeclaration_v.getPropertyValue('background-image');
        const background_repeat = CSSStyleDeclaration_v.getPropertyValue('background-repeat');
        const background_position = CSSStyleDeclaration_v.getPropertyValue('background-position');
        const text_shadow = CSSStyleDeclaration_v.getPropertyValue('text-shadow');

        let add_safe_text_shadow = false;
        if (color) {
            CSSStyleDeclaration_v.setProperty(
                'color',
                this.process_color_property(color, true, false)!,
                CSSStyleDeclaration_v.getPropertyPriority('color'),
            );
        }

        if (
            background.indexOf('var(') >= 0
            && !(preserve_background_color.some((val) => selector.indexOf(val) >= 0))
        ) {
            CSSStyleDeclaration_v.setProperty(
                'background',
                this.process_background_property(background, selector, base_url),
                CSSStyleDeclaration_v.getPropertyPriority('background'),
            );
        }
        if (
            background_color
            && !(preserve_background_color.some((val) => selector.indexOf(val) >= 0))
        ) {
            CSSStyleDeclaration_v.setProperty(
                'background-color',
                this.process_color_property(background_color, false, false)!,
                CSSStyleDeclaration_v.getPropertyPriority('background-color'),
            );
        }
        if (background_image) {
            const bg_images = brackets_aware_split(background_image, undefined);
            let bg_repeats: string[];
            let bg_positions: string[];

            // TODO: combine next two splits:
            if (background_repeat) {
                bg_repeats = background_repeat.split(',').map((bgRep) => bgRep.trim());
            } else {
                bg_repeats = ['repeat'];
            }
            if (background_position) {
                bg_positions = background_position.split(',').map((bgPos) => bgPos.trim());
            } else {
                bg_positions = ['0% 0%'];
            }
            const new_bg_images = bg_images.map((currentValue, index) => {
                const [new_bg_image, add_safe_text_shadow_c] = this.process_background_image(
                    currentValue,
                    // complex index to cycle through bg_repeats
                    bg_repeats[index % bg_repeats.length],
                    bg_positions[index % bg_positions.length],
                    selector,
                    base_url,
                );
                add_safe_text_shadow = add_safe_text_shadow || add_safe_text_shadow_c;
                return new_bg_image;
            });
            CSSStyleDeclaration_v.setProperty(
                'background-image',
                new_bg_images.join(', '),
                CSSStyleDeclaration_v.getPropertyPriority('background-image'),
            );
        }
        if (!add_safe_text_shadow && text_shadow) {
            const parts = brackets_aware_split(text_shadow, undefined).map(
                (text_shadow_splitted) => {
                    const [parsed, color_index] = parse_text_shadow(text_shadow_splitted);
                    if (parsed !== null && color_index !== null) {
                        parsed[color_index] = this.backgroundify_color(parsed[color_index] as RGBA);
                        return parsed.join(' ');
                    } else {
                        return text_shadow_splitted;
                    }
                },
            );
            CSSStyleDeclaration_v.setProperty(
                'text-shadow',
                parts.join(', '),
                CSSStyleDeclaration_v.getPropertyPriority('text-shadow'),
            );
        }
        if (add_safe_text_shadow) {
            if (this.use_webkit_text_stroke) {
                CSSStyleDeclaration_v.setProperty(
                    '-webkit-text-stroke-color',
                    this.options.default_background_color,
                    'important',
                );
                CSSStyleDeclaration_v.setProperty(
                    '-webkit-text-stroke-width',
                    '2px',
                    'important',
                );
            } else {
                const shadow_color = this.options.default_background_color;
                CSSStyleDeclaration_v.setProperty(
                    'text-shadow',
                    [
                        `${shadow_color} 0 0 1px`,
                        `${shadow_color} 0 0 2px`,
                        `${shadow_color} 0 0 3px`,
                        `${shadow_color} 0 0 4px`,
                        `${shadow_color} 0 0 5px`,
                    ].join(', '),
                    'important',
                );
            }
        }
    }

    // detects only trimmed!
    static is_css_var(s: string): boolean {
        return s.indexOf('var(') === 0 && s.lastIndexOf(')') === (s.length - 1);
    }

    static process_css_var_usage(
        css: string,
        var_cb: (var_part: string) => string,
        fallback_cb: (var_part: string) => string,
    ): string {
        let s = css.trim();
        if (!StylesheetColorProcessor.is_css_var(s)) {
            throw new Error(`${s} is not CSS var!`);
        }
        s = s.slice(4, s.length - 1);
        const comma_index = s.indexOf(',');
        if (comma_index >= 0) {
            const var_part = s.slice(0, comma_index).trim();
            const fallback_part = s.slice(comma_index + 1, s.length).trim();
            return `var(${
                var_cb(var_part)
            }, ${
                StylesheetColorProcessor.is_css_var(fallback_part)
                    ? StylesheetColorProcessor.process_css_var_usage(
                        fallback_part,
                        var_cb,
                        fallback_cb,
                    )
                    : fallback_cb(fallback_part)
            })`;
        } else {
            return `var(${var_cb(s.trim())})`;
        }
    }

    process_bg_part(bg_part: string, selector: string, base_url: string): string {
        // eslint-disable-next-line no-param-reassign
        bg_part = bg_part.trim();
        if (StylesheetColorProcessor.is_css_var(bg_part)) {
            return StylesheetColorProcessor.process_css_var_usage(
                bg_part,
                this.rename_var_bg,
                (s) => this.process_bg_part(s, selector, base_url),
            );
        }
        const probably_color = this.process_color_property(bg_part, false, true);
        if (probably_color) {
            return probably_color;
        }
        // TODO: safe text shadow?                      TODO: bg_repeat, bg_position
        return this.process_background_image(bg_part, 'TODO bg_repeat', 'TODO bg_position', selector, base_url)[0];
    }

    process_background_property(bg_prop: string, selector: string, base_url: string): string {
        const bgs = brackets_aware_split(bg_prop, ',');
        const new_bgs = [];
        for (const bg of bgs) {
            const bg_parts = brackets_aware_split(bg, ' ');
            const new_bg_parts = [];
            for (const bg_part of bg_parts) {
                new_bg_parts.push(this.process_bg_part(bg_part, selector, base_url));
            }
            new_bgs.push(new_bg_parts.join(' '));
        }
        return new_bgs.join(', ');
    }

    process_color_property(
        color: string,
        is_foreground: boolean,
        no_ret_if_fail: false,
    ): string
    process_color_property(
        color: string,
        is_foreground: boolean,
        no_ret_if_fail: true,
    ): string | undefined
    process_color_property(
        color: string,
        is_foreground: boolean,
        no_ret_if_fail: boolean,
    ): string | undefined {
        // eslint-disable-next-line no-param-reassign
        color = color.trim();
        const rgb_color_array = parseCSSColor(color);
        if (rgb_color_array) {
            return (
                is_foreground
                    ? this.foregroundify_color(rgb_color_array)
                    : this.backgroundify_color(rgb_color_array)
            );
        } else if (color.indexOf('-moz-') >= 0 || system_colors.indexOf(color.toLowerCase()) >= 0) {
            return (
                is_foreground
                    ? this.options.default_foreground_color
                    : this.options.default_background_color
            );
        } else if (StylesheetColorProcessor.is_css_var(color)) {
            return StylesheetColorProcessor.process_css_var_usage(
                color,
                is_foreground
                    ? this.rename_var_fg
                    : this.rename_var_bg,
                (s) => this.process_color_property(s, is_foreground, false),
            );
        }
        if (!no_ret_if_fail) {
            if (
                color.indexOf('rgba(') === 0
                || color.indexOf('rgb(') === 0
            ) { // instagram weird variable use crutches
                return (
                    is_foreground
                        ? this.options.default_foreground_color
                        : this.options.default_background_color
                );
            } else {
                return color;
            }
        }
        return;
    }

    process_background_image(
        bg_image: string,
        bg_repeat: string,
        bg_position: string,
        selector: string,
        base_url: string,
    ): [string, boolean] {
        if (bg_image.indexOf('url(') === 0) {
            /// all urls will be like url("lalala") UPD: not necessary in var()
            let url = bg_image.slice(bg_image.indexOf('(') + 1, bg_image.lastIndexOf(')'));
            url = url.trim();
            if (url.indexOf('"') === 0 && url.lastIndexOf('"') === (url.length - 1)) {
                url = url.slice(1, url.length - 1);
            }
            // after rewriting workaround_stylesheet to use crossorigin="anonymous"
            // it's no more strictly required
            url = new URL(url, base_url).href;
            if (selector === inline_fake_selector) {
                return [`url("${url}")`, true];
            }
            if (intersect(remove_background_image, [url, selector])) {
                return ['none', false];
            // yep, facebook-only fix (/rsrc.php/), it's too risky to apply it everywhere
            // TODO: check impact of this on other websites
            } else if (
                bg_repeat !== 'no-repeat'
                && bg_repeat !== 'no-repeat no-repeat'
                && bg_image.indexOf('/rsrc.php/') >= 0
            ) {
                return ['none', false];
            } else if (intersect(do_not_remove_background_image, [url, selector])) {
                return [`url("${url}")`, true];
            } else if ( // no-repeat combined with exact bg position is most likely sprite
                (bg_repeat === 'no-repeat' || bg_repeat === 'no-repeat no-repeat')
                && ((bg_position.match(/px/g) || []).length === 2)
            ) {
                return [`url("${url}")`, true];
            } else {
                return ['none', false];
            }
        } else if (bg_image.indexOf('gradient') < bg_image.indexOf('(')) {
            const open_bracket_i = bg_image.indexOf('(');
            const close_bracket_i = bg_image.lastIndexOf(')');
            const gradient_function = bg_image.slice(0, open_bracket_i);
            const params_str = bg_image.slice(open_bracket_i + 1, close_bracket_i);
            const params_arr = brackets_aware_split(params_str, undefined);
            const result_arr = params_arr.map(
                (param) => brackets_aware_split(param, ' ').map((s) => this.process_color_property(s, false, false)).join(' '),
            );
            return [`${gradient_function}(${result_arr.join(', ')})`, false];
        } else {
            return [bg_image, false];
        }
    }
}

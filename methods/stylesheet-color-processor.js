"use strict";

/*
 * Problem sites
 * http://russian.joelonsoftware.com/Articles/BacktoBasics.html FIXED
 * http://www.opennet.ru/opennews/art.shtml?num=37736 FIXED
 * https://davdroid.bitfire.at/what-is-davdroid FIXED added site-special fix, remove bg-image if no-repeat too
 * http://www.dylanbeattie.net/docs/openssl_iis_ssl_howto.html FIXED
 * https://etherpad.mozilla.org/ammo-community-042815
 * http://joyreactor.cc/post/2116903 - hover comments
 * darkest text colors: #9DB8C7 (http://linz.by/)
 * */


const { StylesheetProcessorAbstract, brackets_aware_split } = require('./stylesheet-processor-abstract');
const { parseCSSColor } = require('../css-color-parser/csscolorparser');
const color_utils = require('../color_utils');
const parse_text_shadow = (value) => {
    let color_index;
    let splitted = brackets_aware_split(value, ' ');
    for (let i = 0; i < splitted.length; i++) {
        let parsed_color = parseCSSColor(splitted[i]);
        if (parsed_color) {
            color_index = i;
            splitted[i] = parsed_color;
            break;
        }
    }
    if (!Number.isInteger(color_index))
        return [null, null];
    return [splitted, color_index]
};
const intersect = (set1, set2) => set1.some(
        set1_cur => set2.some(
            set2_cur => (  //TODO: remove redundant .toLowerCase()
                set2_cur.toLowerCase().indexOf(set1_cur.toLowerCase()) >= 0 ||
                set1_cur.toLowerCase().indexOf(set2_cur.toLowerCase()) >= 0
            )
        )
);

const preserve_background_color = [
    '.colorpickertile',
    '.colorpicker-button-colorbox',
    // Youtube
    '.ytp-menuitem-toggle-checkbox',
    '.ytp-volume-slider',
    '.ytp-hover-progress',
    '.ytp-load-progress',
    '.ytp-progress-list',
    '.paper-toggle-button',
];

const remove_background_image = [
    /*'static/cm-bkg.jpg',  //http://review.cyanogenmod.org/
     'images/homepagetop.gif',  //http://trv-science.ru/
     'images/homepagetoptop.gif',
     'images/sidebartop.gif',
     'images/leftsidebartop.gif',
     'images/rightsidebartop.gif',
     'images/bottom.gif'*/ // removed due to "remove bg-image if no-repeat too"
];

const do_not_remove_background_image = [
    'a.add', //test
    'favorite.gif', // habrahabr.ru
    'pageviews.png', //
    'bg-user2.gif',  //,
    'bg-author-link.gif',
    'bg-comments2.gif', // /habrahabr.ru
    'button',
    'btn',
    'icon',
    'logo',
    'stars',
    'sprites',
    'sprite',
    //'menu',
    'Menu',
    's.ytimg.com',
    'toggle',
    'toolbar',
    'progress',
    'face',
    '.svg',
    '/rsrc.php/', // facebook sprites/icons
    '.i-tip', // http://catalog.onliner.by
    '.dijitCheckBox', // at least tt-rss checkboxes
    'checkbox',
    '.current-rating', // https://play.google.com/store/apps/ rating stars
    //'[data-browsertheme]'
    'chrome://wot/', // Web of Trust icons are invisible #13
    '.ytp-gradient-top',     // #70
    '.ytp-gradient-bottom',  // #70
];

const system_colors = [
    // https://developer.mozilla.org/en/docs/Web/CSS/color_value#System_Colors
    'ActiveBorder', 'ActiveCaption', 'AppWorkspace', 'Background', 'ButtonFace', 'ButtonHighlight', 'ButtonShadow',
    'ButtonText', 'CaptionText', 'GrayText', 'Highlight', 'HighlightText', 'InactiveBorder', 'InactiveCaption',
    'InactiveCaptionText', 'InfoBackground', 'InfoText', 'Menu', 'MenuText', 'Scrollbar', 'ThreeDDarkShadow',
    'ThreeDFace', 'ThreeDHighlight', 'ThreeDLightShadow', 'ThreeDShadow', 'Window', 'WindowFrame', 'WindowText'
].map(c => c.toLowerCase());

class StylesheetColorProcessor extends StylesheetProcessorAbstract {
    constructor(window, options) {
        super(window, options, '[style*="color"], [style*="background"]');
        let default_foreground_color = parseCSSColor(this.options.default_foreground_color);
        let default_background_color = parseCSSColor(this.options.default_background_color);
        let is_dark_background = color_utils.relative_luminance(default_background_color) < color_utils.relative_luminance(default_foreground_color);
        let default_colors = is_dark_background ?
            {default_light_color: default_foreground_color, default_dark_color: default_background_color} :
            {default_light_color: default_background_color, default_dark_color: default_foreground_color};
        this.backgroundify_color = color_array => color_utils.lighten_or_darken_color(color_array, is_dark_background, default_colors);
        this.foregroundify_color = color_array => color_utils.lighten_or_darken_color(color_array, !is_dark_background, default_colors);

        this.var_name_postfix = '-dark-background-light-text-add-on-';
        this.rename_var_fg = var_name => `${var_name}${this.var_name_postfix}fg`;
        this.rename_var_bg = var_name => `${var_name}${this.var_name_postfix}bg`;

        this.use_webkit_text_stroke = false; // window.CSS.supports('-webkit-text-stroke', '1px red');
    }
    //CSS2Properties
    process_CSSStyleDeclaration(CSSStyleDeclaration_v,
                                base_url,
                                selector,
                                classList_v,
                                node_id,
                                tagname) {
        let var_properties = [];
        for (let p of CSSStyleDeclaration_v)
            if (p.indexOf('--') === 0 && p.indexOf(this.var_name_postfix) < 0)
                var_properties.push(p);
        for (let p of var_properties) {
            CSSStyleDeclaration_v.setProperty(
                this.rename_var_fg(p),
                this.process_color_property(CSSStyleDeclaration_v.getPropertyValue(p), true),
                CSSStyleDeclaration_v.getPropertyPriority(p)
            );
            CSSStyleDeclaration_v.setProperty(
                this.rename_var_bg(p),
                this.process_background_property(CSSStyleDeclaration_v.getPropertyValue(p)),
                CSSStyleDeclaration_v.getPropertyPriority(p)
            );
        }

        let color = CSSStyleDeclaration_v.getPropertyValue('color');
        // data from shorthand 'background' property available in bg-color and bg-image but only if it isn't var(...)
        let background = CSSStyleDeclaration_v.getPropertyValue('background');
        let background_color = CSSStyleDeclaration_v.getPropertyValue('background-color');
        let background_image = CSSStyleDeclaration_v.getPropertyValue('background-image');
        let background_repeat = CSSStyleDeclaration_v.getPropertyValue('background-repeat');
        let background_position = CSSStyleDeclaration_v.getPropertyValue('background-position');
        let text_shadow = CSSStyleDeclaration_v.getPropertyValue('text-shadow');

        let add_safe_text_shadow = false;
        if (color)
            CSSStyleDeclaration_v.setProperty(
                'color',
                this.process_color_property(color, true),
                CSSStyleDeclaration_v.getPropertyPriority('color')
            );

        if (background.indexOf('var(') >= 0 && !(preserve_background_color.some(val => selector.indexOf(val) >= 0)))
            CSSStyleDeclaration_v.setProperty(
                'background',
                this.process_background_property(background),
                CSSStyleDeclaration_v.getPropertyPriority('background')
            );
        if (background_color && !(preserve_background_color.some(val => selector.indexOf(val) >= 0)))
            CSSStyleDeclaration_v.setProperty(
                'background-color',
                this.process_color_property(background_color, false),
                CSSStyleDeclaration_v.getPropertyPriority('background-color')
            );
        if (background_image) {
            let bg_images = brackets_aware_split(background_image);
            let bg_repeats;
            let bg_positions;

            //TODO: combine next two splits:
            if (background_repeat)
                bg_repeats = background_repeat.split(',').map(bgRep => bgRep.trim());
            else
                bg_repeats = ['repeat'];
            if (background_position)
                bg_positions = background_position.split(',').map(bgPos => bgPos.trim());
            else
                bg_positions = ['0% 0%'];
            let new_bg_images = bg_images.map((currentValue, index) => {
                let {0: new_bg_image, 1: add_safe_text_shadow_c} = this.process_background_image(
                    currentValue,
                    // complex index to cycle through bg_repeats
                    bg_repeats[index % bg_repeats.length],
                    bg_positions[index % bg_positions.length],
                    selector,
                    base_url
                );
                add_safe_text_shadow = add_safe_text_shadow || add_safe_text_shadow_c;
                return new_bg_image;
            });
            CSSStyleDeclaration_v.setProperty(
                'background-image',
                new_bg_images.join(', '),
                CSSStyleDeclaration_v.getPropertyPriority('background-image')
            );
        }
        if (!add_safe_text_shadow && text_shadow) {
            let parts = brackets_aware_split(text_shadow).map(text_shadow => {
                let [parsed, color_index] = parse_text_shadow(text_shadow);
                if (parsed) {
                    parsed[color_index] = this.backgroundify_color(parsed[color_index]);
                    return parsed.join(' ');
                } else
                    return text_shadow;
            });
            CSSStyleDeclaration_v.setProperty(
                'text-shadow',
                parts.join(', '),
                CSSStyleDeclaration_v.getPropertyPriority('text-shadow')
            );
        }
        if (add_safe_text_shadow) {
            if (this.use_webkit_text_stroke) {
                CSSStyleDeclaration_v.setProperty(
                    '-webkit-text-stroke-color',
                    this.options.default_background_color,
                    'important'
                );
                CSSStyleDeclaration_v.setProperty(
                    '-webkit-text-stroke-width',
                    '2px',
                    'important'
                );
            } else {
                let color = this.options.default_background_color;
                CSSStyleDeclaration_v.setProperty(
                    'text-shadow',
                    [
                        `${color} 0 0 1px`,
                        `${color} 0 0 2px`,
                        `${color} 0 0 3px`,
                        `${color} 0 0 4px`,
                        `${color} 0 0 5px`
                    ].join(', '),
                    'important'
                );
            }
        }
    }
    // detects only trimmed!
    static is_css_var(s) {
        return s.indexOf('var(') === 0 && s.lastIndexOf(')') === (s.length - 1);
    }
    static process_css_var_usage(css, var_cb, fallback_cb) {
        let s = css.trim();
        if (!StylesheetColorProcessor.is_css_var(s))
            return;
        s = s.slice(4, s.length - 1);
        let comma_index = s.indexOf(',');
        if (comma_index >= 0) {
            let var_part = s.slice(0, comma_index).trim();
            let fallback_part = s.slice(comma_index + 1, s.length).trim();
            return `var(${var_cb( var_part )}, ${ (StylesheetColorProcessor.is_css_var(fallback_part)) ? StylesheetColorProcessor.process_css_var_usage(fallback_part, var_cb, fallback_cb) : fallback_cb(fallback_part) })`;
        } else
            return `var(${var_cb(s.trim())})`;
    }
    process_bg_part(bg_part) {
        bg_part = bg_part.trim();
        if (StylesheetColorProcessor.is_css_var(bg_part))
            return StylesheetColorProcessor.process_css_var_usage(bg_part, this.rename_var_bg, s => this.process_bg_part(s));
        let probably_color = this.process_color_property(bg_part, false, true);
        if (probably_color)
            return probably_color;
        // TODO: safe text shadow?                      TODO: bg_repeat, bg_position, selector, base_url
        return this.process_background_image(bg_part, 'TODO bg_repeat', 'TODO bg_position', 'selector TODO')[0];
    }
    process_background_property(bg_prop) {
        let bgs = brackets_aware_split(bg_prop, ',');
        let new_bgs = [];
        for (let bg of bgs) {
            let bg_parts = brackets_aware_split(bg, ' ');
            let new_bg_parts = [];
            for (let bg_part of bg_parts)
                new_bg_parts.push(this.process_bg_part(bg_part));
            new_bgs.push(new_bg_parts.join(' '));
        }
        return new_bgs.join(', ');
    }
    process_color_property(color, is_foreground, no_ret_if_fail) {
        let rgb_color_array = parseCSSColor(color);
        if (rgb_color_array)
            return is_foreground ? this.foregroundify_color(rgb_color_array) : this.backgroundify_color(rgb_color_array);
        else if (color.indexOf('-moz-') >= 0 || system_colors.indexOf(color.toLowerCase().trim()) >= 0)
            return is_foreground ? this.options.default_foreground_color : this.options.default_background_color;
        else if (StylesheetColorProcessor.is_css_var(color.trim()))
            return StylesheetColorProcessor.process_css_var_usage(color, is_foreground ? this.rename_var_fg : this.rename_var_bg, s => this.process_color_property(s, is_foreground));
        if (!no_ret_if_fail)
            return color;
    }
    process_background_image(bg_image, bg_repeat, bg_position, selector, base_url) {
        if (bg_image.indexOf('url(') === 0) {
            /// all urls will be like url("lalala") UPD: not necessary in var()
            let url = bg_image.slice(bg_image.indexOf('(') + 1, bg_image.lastIndexOf(')'));
            url = url.trim();
            if (url.indexOf('"') === 0 && url.lastIndexOf('"') === (url.length - 1))
                url = url.slice(1, url.length - 1);
            if (intersect(remove_background_image, [url, selector])) {
                return ['none'];
            // yep, facebook-only fix (/rsrc.php/), it's too risky to apply it everywhere
            //TODO: check impact of this on other websites
            } else if (bg_repeat !== 'no-repeat' && bg_repeat !== 'no-repeat no-repeat' &&
                bg_image.indexOf('/rsrc.php/') >= 0) {
                return ['none'];
            } else if (intersect(do_not_remove_background_image, [url, selector])) {
                return ['url("' + url + '")', true];
            } else if ( // no-repeat combined with exact bg position is most likely sprite
                (bg_repeat === 'no-repeat' || bg_repeat === 'no-repeat no-repeat') &&
                ((bg_position.match(/px/g) || []).length === 2)
            ) {
                return ['url("' + url + '")', true];
            } else {
                return ['none'];
            } /*
             if (url.indexOf('data:') != 0) {
             if (intersect(remove_background_image, [url, selector])) {
             return ['none'];
             } else if (intersect(do_not_remove_background_image, [url, selector])) {
             if (bg_repeat == 'repeat' || bg_repeat == 'repeat repeat')
             return ['url("' + url + '")', true];
             else
             return ['url("' + url + '")', true]
             } else if (bg_repeat == 'no-repeat' || bg_repeat == 'no-repeat no-repeat')
             return ['none']; // ['url("' + url + '")', true];
             else
             return ['none'];
             } else { // data:
             if (bg_repeat == 'no-repeat' || bg_repeat == 'no-repeat no-repeat') {
             return ['url("' + url + '")', true];
             } else {
             return ['none'];
             }
             }  */
        } else if (bg_image.indexOf('gradient') < bg_image.indexOf('(')) {
            let open_bracket_i = bg_image.indexOf('(');
            let close_bracket_i = bg_image.lastIndexOf(')');
            let gradient_function = bg_image.slice(0, open_bracket_i);
            let params_str = bg_image.slice(open_bracket_i + 1, close_bracket_i);
            let params_arr = brackets_aware_split(params_str);
            let result_arr = params_arr.map(
                param => brackets_aware_split(param, ' ').map(s => this.process_color_property(s, false)).join(' ')
            );
            return [gradient_function + '(' + result_arr.join(', ') + ')'];
        } else {
            return [bg_image];
        }
        return [bg_image];
    }
}

exports.StylesheetColorProcessor = StylesheetColorProcessor;

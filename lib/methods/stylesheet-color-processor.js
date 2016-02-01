/*
 * Problem sites
 * http://russian.joelonsoftware.com/Articles/BacktoBasics.html FIXED
 * http://www.opennet.ru/opennews/art.shtml?num=37736 FIXED
 * https://davdroid.bitfire.at/what-is-davdroid FIXED added site-special fix, remove bg-image if no-repeat too
 * http://www.dylanbeattie.net/docs/openssl_iis_ssl_howto.html FIXED
 * https://etherpad.mozilla.org/ammo-community-042815
 *
 * */


var { Class } = require('sdk/core/heritage');
var { StylesheetProcessorAbstract } = require('./stylesheet-processor-abstract');

var Style = require("sdk/stylesheet/style").Style;
var sdk_url = require('sdk/url');
var { parseCSSColor } = require('../css-color-parser/csscolorparser');

var color_utils = require('../color_utils');
var {
    RGB_to_HSV,
    HSV_to_RGB,
    lighten_color,
    darken_color
    } = color_utils;

const count_char_in_string = (char, str) => {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
const split_background_image = (value, separator) => {
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
const intersect = (set1, set2) => set1.some(
        set1_cur => set2.some(
                set2_cur => (set2_cur.indexOf(set1_cur) >= 0 || set1_cur.indexOf(set2_cur) >= 0)
        )
);

//TODO: use it.
const preserve_background_color = {
    classnames: [
        'colorpickertile',
        'colorpicker-button-colorbox'
    ]
};

var remove_background_image = [
    /*'static/cm-bkg.jpg',  //http://review.cyanogenmod.org/
     'images/homepagetop.gif',  //http://trv-science.ru/
     'images/homepagetoptop.gif',
     'images/sidebartop.gif',
     'images/leftsidebartop.gif',
     'images/rightsidebartop.gif',
     'images/bottom.gif'*/ // removed due to "remove bg-image if no-repeat too"
];

var do_not_remove_background_image = [
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
    '.i-tip', // http://catalog.onliner.by
    '.dijitCheckBox', // at least tt-rss checkboxes
    '.current-rating' // https://play.google.com/store/apps/ rating stars
    //'[data-browsertheme]'
];

var StylesheetColorProcessor = Class({
    extends: StylesheetProcessorAbstract,
    initialize: function initialize(window, options) {
        this.style_selector = '[style*="color"], [style*="background"]';
        StylesheetProcessorAbstract.prototype.initialize.call(this, window, options);
        let default_light_color = parseCSSColor(this.options.default_foreground_color);
        let default_dark_color = parseCSSColor(this.options.default_background_color);
        this.default_colors = {default_light_color, default_dark_color};
    },
    //CSS2Properties
    process_CSSStyleDeclaration: function process_CSSStyleDeclaration(
        CSSStyleDeclaration_v,
        base_url,
        selector,
        classList_v,
        node_id,
        tagname
    ) {
        let color = CSSStyleDeclaration_v.getPropertyValue('color');
        // data from shorthand 'background' property available in bg-color and bg-image
        let background_color = CSSStyleDeclaration_v.getPropertyValue('background-color');
        let background_image = CSSStyleDeclaration_v.getPropertyValue('background-image');
        let background_repeat = CSSStyleDeclaration_v.getPropertyValue('background-repeat');

        let add_safe_text_shadow = false;
        if (color) {
            let rgb_color_array = parseCSSColor(color);
            if (rgb_color_array) {
                CSSStyleDeclaration_v.setProperty(
                    'color',
                    color_utils.lighten_color(rgb_color_array, this.default_colors),
                    CSSStyleDeclaration_v.getPropertyPriority('color')
                );
            } else {
                if (color.indexOf('var(') >= 0 || color.indexOf('-moz-') >= 0) { //TODO: proper handling of CSS var()
                    CSSStyleDeclaration_v.setProperty(
                        'color',
                        'rgba(' + this.default_colors.default_light_color.join(', ') + ')',
                        CSSStyleDeclaration_v.getPropertyPriority('color')
                    );
                }
            }
        }
        if (background_color) {
            if (background_color == 'transparent') {
            } else {
                let rgb_color_array = parseCSSColor(background_color);
                if (rgb_color_array) {
                    if (rgb_color_array[3] > 0) {
                        CSSStyleDeclaration_v.setProperty(
                            'background-color',
                            color_utils.darken_color(rgb_color_array, this.default_colors),
                            CSSStyleDeclaration_v.getPropertyPriority('background-color')
                        );
                    }
                } else {
                    if (background_color.indexOf('var(') >= 0 || background_color.indexOf('-moz-') >= 0) { //TODO: proper handling of CSS var()
                        CSSStyleDeclaration_v.setProperty(
                            'background-color',
                            'rgba(' + this.default_colors.default_dark_color.join(', ') + ')',
                            CSSStyleDeclaration_v.getPropertyPriority('background-color')
                        );
                    }
                }
            }
        }
        if (background_image) {
            let bg_images = split_background_image(background_image);
            let bg_repeats;
            if (background_repeat)
                bg_repeats = background_repeat.split(',').map(bgRep => bgRep.trim());
            else
                bg_repeats = ['repeat'];
            let new_bg_images = bg_images.map((currentValue, index) => {
                let {0: new_bg_image, 1: add_safe_text_shadow_c} = this.process_background_image(
                    currentValue,
                    // complex index to cycle through bg_repeats
                    bg_repeats[index % bg_repeats.length],
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
        if (add_safe_text_shadow) {
            CSSStyleDeclaration_v.setProperty(
                'text-shadow',
                '#000 0pt 0pt 1pt,\
            #000 0pt 0pt 2pt,\
            #000 0pt 0pt 3pt,\
            #000 0pt 0pt 4pt,\
            #000 0pt 0pt 5pt,\
            #000 0pt 0pt 5pt,\
            #000 0pt 0pt 5pt',
                'important'
            );
        }
    },
    process_background_image: function process_background_image(bg_image, bg_repeat, selector, base_url) {
        if (bg_image.indexOf('url(') === 0) {
            /// all urls will be like url("lalala")
            let url = bg_image.slice(bg_image.indexOf('("') + 2, bg_image.lastIndexOf('")'));
            if (intersect(remove_background_image, [url, selector])) {
                return ['none'];
            } else if (intersect(do_not_remove_background_image, [url, selector])) {
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
            let params_arr = split_background_image(params_str);
            //TODO: support var() here too
            let result_arr = params_arr.map(param => {
                let parsed_color = parseCSSColor(param);
                if (parsed_color)
                    return color_utils.darken_color(parsed_color, this.default_colors);
                else if (param.indexOf('var(') >= 0) {
                    return 'rgba(' + this.default_colors.default_dark_color.join(', ') + ')';
                } else {
                    return split_background_image(param, ' ').map(param_part => {
                        let parsed_color = parseCSSColor(param_part.trim());
                        if (parsed_color)
                            return color_utils.darken_color(parsed_color, this.default_colors);
                        else
                            return param_part;
                    }).join(' ');
                }
            });
            return [gradient_function + '(' + result_arr.join(', ') + ')'];
        } else {
            return [bg_image];
        }
        return [bg_image];
    }
});

exports.StylesheetColorProcessor = StylesheetColorProcessor;


var attachTo = require("sdk/content/mod").attachTo;
var Style = require("sdk/stylesheet/style").Style;
var sdk_url = require('sdk/url');
var parseCSSColor = require('./csscolorparser').parseCSSColor;
var color_utils = require('./color_utils');
var self = require('sdk/self');
var {
    RGB_to_HSV,
    HSV_to_RGB,
    lighten_color,
    darken_color
    } = color_utils;
var utils = require('./utils');

var rel_url_to_abs = function(rel, base){
    return rel; // TODO: does we need base urls after switching to modifying stylesheets?
    /*if (rel.indexOf('//') == 0) { // dirty tmp hack
        return base.slice(0, base.indexOf('//')) + rel;
    } else
        return sdk_url.URL(rel, base).toString();*/
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
    '.svg'
    //'[data-browsertheme]'
];

var process_background_image = function(bg_image, bg_repeat, selector, base_url) {
    if (bg_image.indexOf('url(') === 0) {
        /// all urls will be like url("lalala")
        let url = bg_image.slice(bg_image.indexOf('("') + 2, bg_image.lastIndexOf('")'));
        if (utils.intersect(remove_background_image, [url, selector])) {
            return ['none'];
        } else if (utils.intersect(do_not_remove_background_image, [url, selector])) {
            return ['url("' + url + '")', true];
        } else {
            return ['none'];
        } /*
        if (url.indexOf('data:') != 0) {
            if (utils.intersect(remove_background_image, [url, selector])) {
                return ['none'];
            } else if (utils.intersect(do_not_remove_background_image, [url, selector])) {
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
        let params_arr = utils.split_background_image(params_str);
        let result_arr = params_arr.map(function (param) {
            let parsed_color = parseCSSColor(param);
            if (parsed_color)
                return color_utils.darken_color(parsed_color);
            else {
                return utils.split_background_image(param, ' ').map(function(param_part){
                    let parsed_color = parseCSSColor(param_part.trim());
                    if (parsed_color)
                        return color_utils.darken_color(parsed_color);
                    else
                        return param_part;
                }).join(' ')
            }
        });
        return [gradient_function + '(' + result_arr.join(', ') + ')'];
    } else {
        return [bg_image];
    }
    return [bg_image];
};



// '_v' is for value because prefix is class name
var process_CSSStyleRule = function (CSSStyleRule_v, window) {
    let CSSStyleDeclaration_v = CSSStyleRule_v.style;
    let base_url = CSSStyleRule_v.parentStyleSheet.href;
    if (!base_url) //CSSStyleRule_v.parentStyleSheet.ownerNode is HTMLStyleElement
                   // so, it has no href
        base_url = window.location.href;
    let color = CSSStyleDeclaration_v.getPropertyValue('color');
    // data from shorthand 'background' property available in bg-color and bg-image
    let background_color = CSSStyleDeclaration_v.getPropertyValue('background-color');
    let background_image = CSSStyleDeclaration_v.getPropertyValue('background-image');
    let background_repeat = CSSStyleDeclaration_v.getPropertyValue('background-repeat');

    let add_safe_text_shadow = false;
    let rules_ = [];
    if (color) {
        let rgb_color_array = parseCSSColor(color);
        if (rgb_color_array) {
            CSSStyleDeclaration_v.setProperty(
                'color',
                color_utils.lighten_color(rgb_color_array),
                CSSStyleDeclaration_v.getPropertyPriority('color')
            );
            //rules_.push('color: ' + color_utils.lighten_color(rgb_color_array) + '!important; ');
        }
    }
    if (background_color) {
        if (background_color == 'transparent') {
            //rules_.push('background-color: ' + background_color + '!important; ');
        } else {
            let rgb_color_array = parseCSSColor(background_color);
            if (rgb_color_array && rgb_color_array[3] > 0) {
                CSSStyleDeclaration_v.setProperty(
                    'background-color',
                    color_utils.darken_color(rgb_color_array),
                    CSSStyleDeclaration_v.getPropertyPriority('background-color')
                );
                //let new_rgb_color = color_utils.darken_color(rgb_color_array);
                //rules_.push('background-color: ' + new_rgb_color + '!important; ');
            }
        }
    }
    if (background_image) {
        let bg_images = utils.split_background_image(background_image);
        let bg_repeats;
        if (background_repeat)
            bg_repeats = background_repeat.split(',').map(
                function (bg_rep) {
                    return bg_rep.trim()
                });
        else
            bg_repeats = ['repeat'];
        let new_bg_images = bg_images.map(function (currentValue, index) {
            let {0: new_bg_image, 1: add_safe_text_shadow_c} = process_background_image(
                currentValue,
                // complex index to cycle through bg_repeats
                bg_repeats[index % bg_repeats.length],
                CSSStyleRule_v.selectorText,
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
        //rules_.push('background-image: ' + new_bg_images.join(', ') + ' !important; ')
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
        /*rules_.push('text-shadow: #000 0pt 0pt 1pt,\
        #000 0pt 0pt 2pt,\
        #000 0pt 0pt 3pt,\
        #000 0pt 0pt 4pt,\
        #000 0pt 0pt 5pt,\
        #000 0pt 0pt 5pt,\
        #000 0pt 0pt 5pt !important;')*/
    }

    if (rules_.length > 0) {
        /*let style;
        if (window.document.querySelector('style#_BBG___')) {
            style = window.document.querySelector('style#_BBG___');
        } else {
            style = window.document.createElement('style');
            style.setAttribute('id', '_BBG___');
            window.document.querySelector('head').appendChild(style);
        }*/
        /*style.sheet.insertRule(CSSStyleRule_v.selectorText + '\n{\n' + rules_.join('\n') + '\n}\n',
            0);*/
        //style.innerHTML += CSSStyleRule_v.selectorText + '\n{\n' + rules_.join('\n') + '\n}\n';

        let prefix = '', postfix = '';// CSSStyleRule_v.parentRule is CSSMediaRule
        if (CSSStyleRule_v.parentRule && CSSStyleRule_v.parentRule.type == 4) {
            prefix = '@media ' + CSSStyleRule_v.parentRule.media.join(',') + ' {';
            postfix = ' }';
        }

        let style = Style({
            source: prefix + CSSStyleRule_v.selectorText + '\n{\n' + rules_.join('\n') + '\n}' + postfix,
            type: 'user'
        });
        attachTo(style, window)
    }
};

var process_CSSStyleSheet = function (CSSStyleSheet_v, window) {
    let rules = CSSStyleSheet_v.cssRules;
    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
        process_CSSRule(rules[ruleIndex], window);
    }
};

var process_CSSImportRule = function (CSSImportRule_v, window) {
    process_CSSStyleSheet(CSSImportRule_v.styleSheet, window);
};

var process_CSSMediaRule = function (CSSMediaRule_v, window) {
    process_CSSStyleSheet(CSSMediaRule_v, window); //TODO: make it as it should be
};

var process_CSSRule = function (CSSRule_v, window) {
    switch (CSSRule_v.type) {
        case 1: // CSSRule.STYLE_RULE
            process_CSSStyleRule(CSSRule_v, window);
            break;
        case 3: // CSSRule.IMPORT_RULE
            process_CSSImportRule(CSSRule_v, window);
            break;
        case 4: // CSSRule.MEDIA_RULE
            process_CSSMediaRule(CSSRule_v, window);
            break;
    }
};
/*
var wait_for_node = function(parent, tag_name, callback, window, no_need_more){
    var observer = new window.MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
            if (mutation.type === 'childList') {
                for (var node_index = 0; node_index < mutation.addedNodes.length; node_index++) {
                    let node = mutation.addedNodes[node_index];
                    if (node.tagName == tag_name.toUpperCase()) {
                        if (no_need_more)
                            observer.disconnect();
                        console.log('got new '+tag_name);
                        callback(node, window);
                    }
                }
            }
        })
    });
    observer.observe(parent, {childList: true});
    return observer;
};

var process_or_wait = function(parent, tag_name, callback, window, no_need_more){
    let observer = wait_for_node(parent, tag_name, callback, window, no_need_more);
    exsistend_nodes = parent.getElementsByTagName(tag_name);
    console.log('got exsistent '+exsistend_nodes.length + ' of '+tag_name);
    for (let node_index = 0; node_index < exsistend_nodes.length; node_index++){
        callback(exsistend_nodes[node_index], window)
    }
    if ((exsistend_nodes.length > 0) && no_need_more) {
        observer.disconnect();
    }
};

var process_CSSStyleSheet_for_given_node = function(node, window){
    let styleSheets = window.document.styleSheets;
    var found = false;
    var styleSheet;
    for (let styleSheetIndex = 0; styleSheetIndex < styleSheets.length; styleSheetIndex++) {
        if (node === styleSheets[styleSheetIndex].ownerNode ||
            (node.href && styleSheets[styleSheetIndex].href && node.href == styleSheets[styleSheetIndex].href)) {
            found = true;
            styleSheet = styleSheets[styleSheetIndex];
            stop;
        }
    }
    if (styleSheet){
        console.log('processing '+node.tagName);
        process_CSSStyleSheet(styleSheet, window);
    } else {
        console.log('waiting for  '+node.tagName);
        var interval = window.setInterval(function(){
            console.log('still waiting '+node.href);
            let styleSheets = window.document.styleSheets;
            for (let styleSheetIndex = 0; styleSheetIndex < styleSheets.length; styleSheetIndex++) {
                if (node === styleSheets[styleSheetIndex].ownerNode ||
                    (node.href && styleSheets[styleSheetIndex].href && node.href == styleSheets[styleSheetIndex].href)) {
                    found = true;
                    styleSheet = styleSheets[styleSheetIndex];
                    stop;
                }
            }
            if (styleSheet) {
                console.log('waited for  '+node.tagName);
                window.clearInterval(interval);
                process_CSSStyleSheet(styleSheet, window);
            }
        }, 100);
    }
    console.log('lalalalaa '+ node.tagName);
};

var process_link_tag = function(link, window){
    process_CSSStyleSheet_for_given_node(link, window);
};

var process_style_tag = function(style, window){
    process_CSSStyleSheet_for_given_node(style, window);
};

var process_head_tag = function(head, window){
    process_or_wait(head, 'link', process_link_tag, window, false);
    process_or_wait(head, 'style', process_style_tag, window, false);
};

var process_html_tag = function (html, window) {
    process_or_wait(html, 'head', process_head_tag, window, true);
    process_or_wait(html, 'body', process_head_tag, window, true);
};
*/
var main = function (window) {
    var stylesheet_utils = require("sdk/stylesheet/utils");
    var self = require('sdk/self');
    var processed_property_name = ['stylesheet_processed', self.name, self.id].join('_').replace('@', '_');
    //console.log(processed_property_name);
    var process = function(){
        //console.log('processing');
        let start = (new Date()).getTime();
        let sheets = window.document.styleSheets;
        //console.log(sheets.length);
        for (let styleSheetIndex = 0; styleSheetIndex < sheets.length; styleSheetIndex++) {
            let sheet = sheets[styleSheetIndex];
            if (sheet[processed_property_name]) {}
            else {
                if (sheet.ownerNode && sheet.ownerNode.id != '_BBG___') {
                    process_CSSStyleSheet(sheet, window);
                    sheet[processed_property_name] = true;
                }
            }
        }
        let end = (new Date()).getTime();
        let time = end - start;
        //console.log('Main stylesheet generator took: ' + time);
    };
    process();
    window.setInterval(process, 500);
    window.addEventListener('load', function () {
        stylesheet_utils.removeSheet(window, self.data.url('methods/base.css'), 'user');
        stylesheet_utils.removeSheet(window, self.data.url('methods/simple-css.css'), 'user');
    });
    /*//process_or_wait(window.document, 'html', process_html_tag, window, true);
    var sheets = window.document.styleSheets;
    var iter = sheets['@@iterator']();
    var last = 0;
    try {
        while (true) {
            let sheet = iter.next();
            process_CSSStyleSheet(sheet, window);
            last++;
        }
    } catch (ex) {
        window.setInterval(function(){
            try {
                iter = sheets['@@iterator']();
                for (let [i, sheet] in iter) {
                    if (i > last) {
                        last++;
                        process_CSSStyleSheet(sheet, window);
                        console.log('got new sheet');
                    }
                }
            } catch (ex) {}
        }, 100)
    }*/

    /*window.addEventListener('load', function () {
        var time1 = (new Date()).getTime();
        let styleSheets = window.document.styleSheets;
        for (let styleSheetIndex = 0; styleSheetIndex < styleSheets.length; styleSheetIndex++) {
            process_CSSStyleSheet(styleSheets[styleSheetIndex], window);
        }
        var time2 = (new Date()).getTime();
        console.log('>>>>>time spent to change styles: ' + (time2 - time1));
    });*/
};
exports.main = main;
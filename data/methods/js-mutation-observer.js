var target;
target = document;
var observers = new Array();
var config = {childList: true, attributes: true};

var RGB_to_HSV = function (R_, G_, B_) {
    var R = R_ / 255;
    var G = G_ / 255;
    var B = B_ / 255;

    var MAX = Math.max(R, G, B);
    var MIN = Math.min(R, G, B);

    var H;
    var S;
    var V = MAX;

    /*H*/
    if (MAX == MIN)
        H = 0
    else if (MAX == R && G >= B)
        H = 60 * ( (G - B) * 1.0 / (MAX - MIN) ) + 0;
    else if (MAX == R && G < B)
        H = 60 * ( (G - B) * 1.0 / (MAX - MIN) ) + 360;
    else if (MAX == G)
        H = 60 * ( (B - R) * 1.0 / (MAX - MIN) ) + 120;
    else if (MAX == B)
        H = 60 * ( (R - G) * 1.0 / (MAX - MIN) ) + 240;

    /*S*/
    if (MAX == 0)
        S = 0;
    else
        S = 1 - (MIN * 1.0 / MAX);

    return {
        'H': H,
        'S': S,
        'V': V
    };
};

var HSV_to_RGB = function (H_, S_, V_) {
    var H = H_;
    var S = S_ * 100;
    var V = V_ * 100;

    var H_i = Math.floor(H * 1.0 / 60);
    var V_min = ((100 - S) * V * 1.0) / 100;
    var a = ( V - V_min ) * ( (H % 60) * 1.0 / 60);
    var V_inc = V_min + a;
    var V_dec = V - a;
    var R, G, B;

    if (H_i == 0) {
        R = V;
        G = V_inc;
        B = V_min;
    }
    else if (H_i == 1) {
        R = V_dec;
        G = V;
        B = V_min;
    }
    else if (H_i == 2) {
        R = V_min;
        G = V;
        B = V_inc;
    }
    else if (H_i == 3) {
        R = V_min;
        G = V_dec;
        B = V;
    }
    else if (H_i == 4) {
        R = V_inc;
        G = V_min;
        B = V;
    }
    else if (H_i == 5) {
        R = V;
        G = V_min;
        B = V_dec;
    }
    return {
        'R': Math.floor(R * 2.55),
        'G': Math.floor(G * 2.55),
        'B': Math.floor(B * 2.55)
    };
};


var process_node = function (node) {
    if (node.getAttribute && node.getAttribute('__black_background-processed') != true) {
        let computedStyle = window.getComputedStyle(node);
        let fg_rgb_color_array = computedStyle.color.split(/rgb\(|, |\)/);
        let bg_rgb_color_array = computedStyle.backgroundColor.split(/rgb\(|, |\)/);
        let fg_hsv_color = RGB_to_HSV(
            fg_rgb_color_array[1],
            fg_rgb_color_array[2],
            fg_rgb_color_array[3]
        );
        let bg_hsv_color = RGB_to_HSV(
            bg_rgb_color_array[1],
            bg_rgb_color_array[2],
            bg_rgb_color_array[3]
        );
        let new_fg_color_arr;
        if (fg_hsv_color['S'] == 0)
            new_fg_color_arr = {'R': 255, 'G': 255, 'B': 255};
        else
            new_fg_color_arr = HSV_to_RGB(fg_hsv_color['H'], 0.5, 1);
        var new_fg_color = [
            'rgb(',
            new_fg_color_arr['R'],
            ', ',
            new_fg_color_arr['G'],
            ', ',
            new_fg_color_arr['B'],
            ')'
        ].join('');
        let new_bg_color_arr;
        if (bg_hsv_color['S'] == 0)
            new_bg_color_arr = {'R': 0, 'G': 0, 'B': 0};
        else
            new_bg_color_arr = HSV_to_RGB(bg_hsv_color['H'], 1, 0.25);
        var new_bg_color = [
            'rgb(',
            new_bg_color_arr['R'],
            ', ',
            new_bg_color_arr['G'],
            ', ',
            new_bg_color_arr['B'],
            ')'
        ].join('');

        if (computedStyle.backgroundColor != "transparent") {
            node.style.cssText +=
                'color: _FG !important; \
                background-color: _BG !important; \
                background-image: none;'
                    .replace('_FG', new_fg_color)
                    .replace('_BG', new_bg_color);
        } else {
            node.style.cssText +=
                'color: _FG !important; \
                background-image: none;'
                    .replace('_FG', new_fg_color);
        }
        node.setAttribute('__black_background-processed', true);
    }
};

var observe_node = function (node) {
    if ((node.getAttribute && node.getAttribute('__black_background-observed') != true) || !(node.getAttribute)) {
        var observer = new MutationObserver(mutation_occur);
        observers.push(observer);
        observer.observe(node, config);
        node.setAttribute('__black_background-observed', true);
    }
};

var process_and_observe_node = function (node) {
    observe_node(node);
    process_node(node);
};

var init_process_node_and_children = function (node) {
    if (node.getElementsByTagName) {
        var nodes = node.getElementsByTagName('*');
        var arr = Array.prototype.slice.call(nodes);
        arr.push(node);
        for (var i = 0; i < arr.length; i++) {
            process_and_observe_node(arr[i]);
        }
    }
};

var mutation_occur = function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
            for (var ni = 0; ni < mutation.addedNodes.length; ni++) {
                var node = mutation.addedNodes[ni];
                init_process_node_and_children(node);
            }
        }
        if (mutation.type === 'attributes' &&
            mutation.attributeName !== 'style' &&
            mutation.attributeName !== '__black_background-processed' &&
            mutation.attributeName !== '__black_background-observed') {
            node = mutation.target;
            process_node(node);
        }
    });
};
init_process_node_and_children(target);
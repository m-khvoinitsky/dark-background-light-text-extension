var color_chooser = new (function() {
    var chooser = this;
    chooser.h = 0;
    chooser.s = 50;
    chooser.l = 50;
    // from csscolorparser.js
    chooser.parse_color_light = function(color) {
        var str = color.replace(/ /g, '').toLowerCase();
        if (str[0] === '#') {
            if (str.length === 4) {
                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
                if (!(iv >= 0 && iv <= 0xfff)) return null;  // Covers NaN.
                return [((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8),
                    (iv & 0xf0) | ((iv & 0xf0) >> 4),
                    (iv & 0xf) | ((iv & 0xf) << 4),
                    1];
            } else if (str.length === 7) {
                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
                if (!(iv >= 0 && iv <= 0xffffff)) return null;  // Covers NaN.
                return [(iv & 0xff0000) >> 16,
                    (iv & 0xff00) >> 8,
                    iv & 0xff,
                    1];
            }
            return null;
        }
    };
    chooser.setHSL = function(h, s, l) {

    };
    chooser.orig_to_our = new WeakMap();
    chooser.our_to_orig = new WeakMap();
    chooser.current_our_input = null;
    chooser.current_orig_input = null;
    chooser.current_choosing_canvas_id = '';
    chooser.dims_cache = {};
    chooser.process_resize = function() {
        // update dims_cache
        ['canvas_hl', 'canvas_s'].forEach(function(id){
            var computed_style = window.getComputedStyle(document.getElementById(id));
            var border_top = parseFloat(computed_style['border-top-width']);
            var border_left = parseFloat(computed_style['border-left-width']);
            var border_bottom = parseFloat(computed_style['border-bottom-width']);
            var border_right = parseFloat(computed_style['border-right-width']);

            var width = parseFloat(computed_style['width']) - (border_left + border_right);
            var height = parseFloat(computed_style['height']) - (border_top + border_bottom);

            chooser.dims_cache[id] = {
                border_top: border_top,
                border_left: border_left,
                border_bottom: border_bottom,
                border_right: border_right,
                width: width,
                height: height
            }
        });

        // update marker_s size
        var marker = document.querySelector('#color_chooser_svg_marker_s');
        var marker_style = window.getComputedStyle(marker);

        var m_h = parseFloat(marker_style['height']);
        var m_w = chooser.dims_cache['canvas_s'].width;
        var svg_width = m_w*(100/m_h);
        marker.style.right = (chooser.dims_cache['canvas_s'].border_right) + 'px';
        marker.setAttribute('viewBox', '0 0 '+svg_width+' 100');
        marker.querySelector('rect').setAttribute('width', ''+(svg_width+30));
        marker.querySelectorAll('polygon')[1].setAttribute('points', ''+(svg_width+45)+',-20 '+(svg_width+45)+',20 '+(svg_width+25)+',0');
    };
    chooser.our_input_onfocus = function(event) {
        var r = event.target.getBoundingClientRect();
        var x = r.left + window.scrollX;
        var y = r.top + window.scrollY + r.height;
        chooser.container.style.top = y+'px';
        chooser.container.style.left = x+'px';

        ////////////////

        chooser.container.style.visibility = 'visible';
        chooser.current_our_input = event.target;
    };
    chooser.our_input_onblur = function(event) {
        if (chooser.current_choosing_canvas_id.length == 0)
            chooser.container.style.visibility = 'hidden';
    };
    chooser.canvas_onmouse = function(event) {
        var offsetX, offsetY;
        switch (event.type) {
            case 'mousedown':
                event.target.addEventListener('mousemove', chooser.canvas_onmouse);
            case 'touchstart':
                chooser.current_choosing_canvas_id = event.target.getAttribute('id');
                chooser.process_resize();
                break;
            case 'mouseup':
                event.target.removeEventListener('mousemove', chooser.canvas_onmouse);
                chooser.current_choosing_canvas_id = '';
                chooser.current_our_input.focus();
                break;
            case 'touchend':
            case 'touchcancel':
                chooser.current_choosing_canvas_id = '';
                chooser.current_our_input.focus();
                break;
        }

        if (event.type.indexOf('mouse') >= 0) { // mouse
            if (event.buttons == 0 || event.target.getAttribute('id') != chooser.current_choosing_canvas_id) {
                event.target.removeEventListener('mousemove', chooser.canvas_onmouse);
                chooser.current_choosing_canvas_id = '';
                return;
            }
            offsetX = event.offsetX;
            offsetY = event.offsetY;
            if (isNaN(offsetX) || isNaN(offsetY))
                return; // mousedown on touchscreen
        } else {                                // touch
            if (event.targetTouches.length > 0) {
                var boundingClientRect = event.target.getBoundingClientRect();
                var touch = event.targetTouches[0];
                offsetX = touch.pageX - boundingClientRect.x;
                offsetY = touch.pageY - boundingClientRect.y;
            } else  // touchend
                return;
        }

        var real_height = 100.0;
        var real_width = event.target.getAttribute('id') === 'canvas_hl' ? 360.0 : 1.0;
        var dims = chooser.dims_cache[event.target.getAttribute('id')];

        var x = offsetX * (real_width/dims.width);
        var y = offsetY * (real_height/dims.height);

        if (event.target.getAttribute('id') === 'canvas_hl') {
            var h = x;
            var l = y;
            if (h < 0)
                h = 0;
            if (h > 360)
                h = 360;
            if (l < 0)
                l = 0;
            if (l > 100)
                l = 100;
            chooser.h = h;
            chooser.l = l;
            chooser.update_s();
        } else {
            var s = y;
            if (s < 0)
                s = 0;
            if (s > 100)
                s = 100;
            chooser.s = s;
            chooser.update_hl();
        }

    };

    chooser.bind = function() {
        Array.prototype.forEach.call(
            document.querySelectorAll('input[type="color"].color-chooser'),
            function(orig_input) {
                var new_input = document.createElement('input');
                chooser.orig_to_our.set(orig_input, new_input);
                chooser.our_to_orig.set(new_input, orig_input);
                orig_input.style.display = 'none';
                orig_input.parentNode.insertBefore(new_input, orig_input);
                //TODO: clone attrs here
                new_input.addEventListener('focus', chooser.our_input_onfocus);
                new_input.addEventListener('blur', chooser.our_input_onblur);
            }
        );
    };
    chooser.init = function() {
        var container = document.createElement('div');
        chooser.container = container;
        chooser.container.style.visibility = 'hidden';
        container.setAttribute('id', 'color_chooser_container');
        var svg_hl;
        var svg_s;
        [svg_hl, svg_s].forEach(function(svg, i){
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('class', 'color_chooser_svg_marker');
            svg.setAttribute('id', 'color_chooser_svg_marker_' + (i == 0 ? 'hl' : 's'));
            if (i == 0) {
                var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                [
                    ['cx', '0'],
                    ['cy', '0'],
                    ['r', '15'],
                    ['stroke', 'white'],
                    ['stroke-width', '5'],
                    ['fill', 'transparent']
                ].forEach(function(attr){ circle.setAttribute(attr[0], attr[1]) });
                svg.appendChild(circle);
                for (var i = 0; i < 4; i++) {
                    var polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', [
                        '-45,-20 -25,0 -45,20',
                        '-20,-45 20,-45 0,-25',
                        '45,-20 45,20 25,0',
                        '-20,45 20,45 0,25'
                    ][i]);
                    polygon.setAttribute('fill', 'black');
                    polygon.setAttribute('stroke', 'white');
                    polygon.setAttribute('stroke-width', '5');
                    svg.appendChild(polygon);
                }
            } else {
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                [
                    ['x', '-15'],
                    ['y', '-15'],
                    ['width', '30'], /**/
                    ['height', '30'],
                    ['rx', '15'],
                    ['ry', '15'],
                    ['stroke', 'white'],
                    ['stroke-width', '5'],
                    ['fill', 'transparent']
                ].forEach(function(attr){ rect.setAttribute(attr[0], attr[1]) });
                svg.appendChild(rect);
                for (var i = 0; i < 2; i++) {
                    var polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', [
                        '-45,-20 -25,0 -45,20',
                        '95,30 95,70 75,50'
                    ][i]);
                    polygon.setAttribute('fill', 'black');
                    polygon.setAttribute('stroke', 'white');
                    polygon.setAttribute('stroke-width', '5');
                    svg.appendChild(polygon);
                }
            }
            container.appendChild(svg);
        });
        var canvas_hl;
        var canvas_s;
        [canvas_hl, canvas_s].forEach(function(canvas, i){
            canvas = document.createElement('canvas');
            canvas.classList.add('canvas_hsl');
            canvas.setAttribute('id', 'canvas_' + (i == 0 ? 'hl' : 's'));
            canvas.setAttribute('width', (i == 0 ? '360' : '1'));
            canvas.setAttribute('height', '100');
            var ctx = canvas.getContext("2d");
            ctx.createImageData((i == 0 ? 360 : 1), 100);
            container.appendChild(canvas);
            canvas.addEventListener('mousedown', chooser.canvas_onmouse);
            canvas.addEventListener('mouseup', chooser.canvas_onmouse);
            canvas.addEventListener('touchstart', chooser.canvas_onmouse);
            canvas.addEventListener('touchend', chooser.canvas_onmouse);
            canvas.addEventListener('touchmove', chooser.canvas_onmouse);
        });
        document.querySelector('body').appendChild(container);
        chooser.process_resize();
        chooser.update_hl();
        chooser.update_s();
    };
    chooser.update_hl = function() {
        var ctx = document.querySelector('#canvas_hl').getContext("2d");
        for (var l = 0; l <= 100; l++) {
            var gradient = ctx.createLinearGradient(0, 0, 360, 0);
            for (var hi = 0; hi <= 6; hi++) {
                gradient.addColorStop(hi/6, 'hsl(' + [
                        hi*60,
                        chooser.s + '%',
                        l + '%'
                    ].join(', ') + ')');
            };
            ctx.fillStyle = gradient;
            ctx.fillRect(0, l, 360, 1)
        }

        var marker = document.querySelector('#color_chooser_svg_marker_s');
        var dims = chooser.dims_cache['canvas_s'];
        marker.style.top = (dims.border_top + dims.height * (chooser.s/100)) + 'px';
    };
    chooser.update_s = function() {
        var ctx = document.querySelector('#canvas_s').getContext("2d");
        var gradient = ctx.createLinearGradient(0, 0, 1, 100);
        for (var si = 0; si <= 1; si++) {
            gradient.addColorStop(si, 'hsl(' + [
                    chooser.h,
                    si * 100 + '%',
                    chooser.l + '%'
                ].join(', ') + ')');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 100);

        var marker = document.querySelector('#color_chooser_svg_marker_hl');
        var dims = chooser.dims_cache['canvas_hl'];

        marker.style.top = (dims.border_top + dims.height * (chooser.l/100)) + 'px';
        marker.style.left = (dims.border_left + dims.width * (chooser.h/360)) + 'px';
    };

    chooser.init();
    chooser.bind();
    return chooser;
})();
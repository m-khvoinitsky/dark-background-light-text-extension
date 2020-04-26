import type {RGBA, RGB, HSL, HSV_obj, RGB_obj, DefaultColors} from './types';
declare var { get_acceptable_range }: typeof import('./get_acceptable_range');

export function RGB_to_HSL(rgb_array: RGB): HSL {
    let R = (1.0 * rgb_array[0]) / 255;
    let G = (1.0 * rgb_array[1]) / 255;
    let B = (1.0 * rgb_array[2]) / 255;
    let MAX = Math.max(R, G, B);
    let MIN = Math.min(R, G, B);
    let H;
    if (MAX == MIN)
        // H has no effect, set it to 0 to prevent undefined;
        H = 0;
    else if (MAX == R && G >= B)
        H = 60.0 * (G - B)/(MAX - MIN);
    else if (MAX == R && G < B)
        H = 60.0 * (G - B)/(MAX - MIN) + 360;
    else if (MAX == G)
        H = 60.0 * (B - R)/(MAX - MIN) + 120;
    else if (MAX == B)
        H = 60.0 * (R - G)/(MAX - MIN) + 240;
    else
        throw new Error('this code should have hever been reached')
    let L = (MAX + MIN)/2;
    let S = (MAX - MIN)/(1 - Math.abs(1 - (MAX + MIN)));
    if (Number.isNaN(S)) // isNaN is too slow
        S = 0;
    return [H, S * 100, L * 100];
};

export function RGB_to_HSV(R_: number, G_: number, B_: number): HSV_obj {
    let R = 1.0 * R_ / 255;
    let G = 1.0 * G_ / 255;
    let B = 1.0 * B_ / 255;

    let MAX = Math.max(R, G, B);
    let MIN = Math.min(R, G, B);

    let H;
    let S;
    let V = MAX;

    /*H*/
    if (MAX == MIN)
        H = 0;
    else if (MAX == R && G >= B)
        H = 60 * ( (G - B) / (MAX - MIN) );
    else if (MAX == R && G < B)
        H = 60 * ( (G - B) / (MAX - MIN) ) + 360;
    else if (MAX == G)
        H = 60 * ( (B - R) / (MAX - MIN) ) + 120;
    else if (MAX == B)
        H = 60 * ( (R - G) / (MAX - MIN) ) + 240;
    else
        throw new Error('this code should have hever been reached')

    /*S*/
    if (MAX == 0)
        S = 0;
    else
        S = 1 - (MIN / MAX);

    return {
        'H': H,
        'S': S,
        'V': V
    };
};

export function HSV_to_RGB(H_: number, S_: number, V_: number): RGB_obj {
    let H = H_ * 1.0;
    let S = S_ * 100.0;
    let V = V_ * 100.0;

    let H_i = Math.floor(H / 60);
    let V_min = ((100 - S) * V) / 100;
    let a = ( V - V_min ) * ( (H % 60) * 1.0 / 60);
    let V_inc = V_min + a;
    let V_dec = V - a;
    let R, G, B: number;

    switch (H_i) {
        case 0:
            R = V
            G = V_inc
            B = V_min
            break
        case 1:
            R = V_dec
            G = V
            B = V_min
            break
        case 2:
            R = V_min
            G = V
            B = V_inc
            break
        case 3:
            R = V_min
            G = V_dec
            B = V
            break
        case 4:
            R = V_inc
            G = V_min
            B = V
            break
        case 5:
            R = V
            G = V_min
            B = V_dec
            break
        default:
            throw new Error('bad H_i value')
    }
    return {
        'R': Math.floor(R * 2.55),
        'G': Math.floor(G * 2.55),
        'B': Math.floor(B * 2.55),
    };
};

export function lighten_or_darken_color(
    rgba_color_array: RGBA,
    darken_not_lighten: boolean,
    options: DefaultColors,
): string {
    let hsl_color_array = RGB_to_HSL(rgba_color_array.slice(0, 3) as RGB);
    let H = hsl_color_array[0];
    let S = hsl_color_array[1];
    let L = hsl_color_array[2];
    let alpha = rgba_color_array[3];
    let range = get_acceptable_range(H);
    let new_L;
    if (S < 20) {
        if (darken_not_lighten) {
            return 'rgba(' + [
                options.default_dark_color[0],
                options.default_dark_color[1],
                options.default_dark_color[2],
                alpha
            ].join(', ') + ')';
        } else {
            return 'rgba(' + [
                    options.default_light_color[0],
                    options.default_light_color[1],
                    options.default_light_color[2],
                    alpha
                ].join(', ') + ')';
        }
    }
    if (darken_not_lighten) {
        if (L <= range[0])
            new_L = L;
        else if (L >= 100 - range[0])
            new_L = 100 - L;
        else
            new_L = range[0];
    } else {
        if (L >= range[1])
            new_L = L;
        else if (L <= 100 - range[1])
            new_L = 100 - L;
        else
            new_L = range[1];
    }
    return 'hsla('+
            H + ', '+
            S + '%, '+
            new_L + '%, '+
            alpha + ')'
};

export function lighten_color(rgba_color_array: RGBA, options: DefaultColors): string {
    return lighten_or_darken_color(rgba_color_array, false, options);
};

export function darken_color(rgba_color_array: RGBA, options: DefaultColors): string {
    return lighten_or_darken_color(rgba_color_array, true, options);
};

export function relative_luminance(color_array: RGB): number {
    let R = (1.0 * color_array[0]) / 255;
    let G = (1.0 * color_array[1]) / 255;
    let B = (1.0 * color_array[2]) / 255;
    // https://en.wikipedia.org/wiki/Luma_(video)#Luma_versus_relative_luminance
    // coefficients defined by Rec. 601
    return 0.299 * R + 0.587 * G + 0.114 * B
}

function RGB_to_YPbPr(rgb_array) {
    // https://en.wikipedia.org/wiki/YCbCr#JPEG_conversion
    let [R, G, B] = rgb_array;
    let Yp = (0.299 * R) + (0.587 * G) + (0.114 * B);
    let Cb = 128 - (0.168736 * R ) - (0.331264 * G) + (0.5 * B);
    let Cr = 128 + (0.5 * R) - (0.418688 * G) - (0.081312 * B);
    return [Yp, Cb, Cr]
}
function YPbPr_to_RGB(YPbPr_array) {
    let [Yp, Cb, Cr] = YPbPr_array;
    let R = Yp + 1.402 * (Cr - 128);
    let G = Yp - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
    let B = Yp + 1.772 * (Cb - 128);
    return [R, G, B]
}

function RGB_to_HSV(rgb_array) {
    let [R_, G_, B_] = rgb_array
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

    /*S*/
    if (MAX == 0)
        S = 0;
    else
        S = 1 - (MIN / MAX);

    return [H, S * 100, V * 100];
};

function adjust_luminance(rgba_color_array, reference_color){
    // let [H, S, V] = RGB_to_HSV(rgba_color_array);
    let [Yp, Cb, Cr] = RGB_to_YPbPr(rgba_color_array);
    let alpha = rgba_color_array[3];
    let [d_Yp, d_Cb, d_Cr] = RGB_to_YPbPr(reference_color);
    let [new_R, new_G, new_B] = YPbPr_to_RGB([d_Yp, Cb, Cr]);
    return `rgba(${new_R}, ${new_G}, ${new_B}, ${alpha})`;
}

function relative_luminance(color_array) {
    let R = (1.0 * color_array[0]) / 255;
    let G = (1.0 * color_array[1]) / 255;
    let B = (1.0 * color_array[2]) / 255;
    // https://en.wikipedia.org/wiki/Luma_(video)#Luma_versus_relative_luminance
    // coefficients defined by Rec. 601
    return 0.299 * R + 0.587 * G + 0.114 * B
}

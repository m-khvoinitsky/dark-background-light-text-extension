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
    let [H, S, V] = RGB_to_HSV(rgba_color_array);
    let [Yp, Cb, Cr] = RGB_to_YPbPr(rgba_color_array);
    let alpha = rgba_color_array[3];
    let [d_Yp, d_Cb, d_Cr] = RGB_to_YPbPr(reference_color);
    console.log(S);
    if (S < 10) {
        return `rgba(${reference_color[0]}, ${reference_color[1]}, ${reference_color[2]}, ${alpha})`
    }
    let new_Yp;
    console.log(d_Yp);
    if (Yp > 128 && d_Yp <= 128)
        new_Yp = ((255 - Yp) + d_Yp) / 2;
    else
        new_Yp = (Yp + d_Yp) / 2;
    new_Yp = d_Yp < 128 ? d_Yp + (50 * (V / 100)) : d_Yp - (50 * (V / 100))
    let new_RGB = YPbPr_to_RGB([new_Yp, Cb, Cr])
    return `rgba(${new_RGB[0]}, ${new_RGB[1]}, ${new_RGB[2]}, ${alpha})`
};

function relative_luminance(color_array) {
    let R = (1.0 * color_array[0]) / 255;
    let G = (1.0 * color_array[1]) / 255;
    let B = (1.0 * color_array[2]) / 255;
    // https://en.wikipedia.org/wiki/Luma_(video)#Luma_versus_relative_luminance
    // coefficients defined by Rec. 601
    return 0.299 * R + 0.587 * G + 0.114 * B
}

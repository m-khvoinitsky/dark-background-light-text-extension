               // red, yellow, green, cyan, blue, magenta
const max_bg_L = [50, 25, 30, 25, 60, 45];
const min_fg_L = [80, 40, 45, 40, 85, 75];

const get_acceptable_range = function(H){
    H = H % 360; // cycle it
    let n = Math.floor( H / 60);
    let dark_start = max_bg_L[(n) % 6];
    let dark_end = max_bg_L[(n + 1) % 6];
    let light_start = min_fg_L[(n) % 6];
    let light_end = min_fg_L[(n + 1) % 6];

    let pi_multiplier = (H % 60) / 60;
    let start_angle = 3*Math.PI/2;
    let angle = start_angle + (Math.PI)*pi_multiplier;
    let multiplier = (Math.sin(angle) + 1) / 2;
    return [
        Math.round(
            dark_start + multiplier*(dark_end - dark_start)
        ),
        Math.round(
            light_start + multiplier*(light_end - light_start)
        )
    ];
};
try {exports.get_acceptable_range = get_acceptable_range;} catch (e) {}

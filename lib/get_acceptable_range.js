var get_acceptable_range = function(H){
    H = H % 360; // cycle it
    var n = Math.floor( H / 60);
    // red, yellow, green, cyan, blue, magenta
    var max_bg_L = [50, 25, 30, 25, 60, 45];
    var min_fg_L = [80, 40, 45, 40, 85, 75];
    var dark_start = max_bg_L[(n) % 6];
    var dark_end = max_bg_L[(n + 1) % 6];
    var light_start = min_fg_L[(n) % 6];
    var light_end = min_fg_L[(n + 1) % 6];

    var pi_multiplier = (H % 60) / 60;
    var start_angle = 3*Math.PI/2;
    var angle = start_angle + (Math.PI)*pi_multiplier;
    var multiplier = (Math.sin(angle) + 1) / 2;
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

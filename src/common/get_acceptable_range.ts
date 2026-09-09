//                red, yellow, green, cyan, blue, magenta
const max_bg_L = [50, 25, 30, 25, 60, 45];
const min_fg_L = [80, 40, 45, 40, 85, 75];

export function get_acceptable_range(H: number): [number, number] {
  H %= 360; // cycle it
  const n = Math.floor(H / 60);
  const dark_start = max_bg_L[n % 6];
  const dark_end = max_bg_L[(n + 1) % 6];
  const light_start = min_fg_L[n % 6];
  const light_end = min_fg_L[(n + 1) % 6];

  const pi_multiplier = (H % 60) / 60;
  const start_angle = (3 * Math.PI) / 2;
  const angle = start_angle + Math.PI * pi_multiplier;
  const multiplier = (Math.sin(angle) + 1) / 2;
  return [
    Math.round(dark_start + multiplier * (dark_end - dark_start)),
    Math.round(light_start + multiplier * (light_end - light_start)),
  ];
}

const { Cu } = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

exports.get_sytem_font_style = function get_sytem_font_style() {
    let rootwin = Services.wm.getMostRecentWindow("navigator:browser");
    let { color, fontFamily, fontSize, fontWeight } = rootwin.getComputedStyle(rootwin.document.documentElement);
    return `html, body {
  color: ${color};
  font-family: ${fontFamily}, -apple-system, "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "Oxygen", "Dejavu Sans", "Fira Sans", "Droid Sans", "Helvetica Neue", "Arial", sans-serif;
  font-weight: ${fontWeight};
  font-size: ${fontSize};
}`;
};
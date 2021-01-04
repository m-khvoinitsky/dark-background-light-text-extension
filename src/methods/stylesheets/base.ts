import { RenderOptions } from '../../common/types';
export const name = 'base';
export function render({
    default_foreground_color,
    default_background_color,
    default_link_color,
    default_visited_color,
    default_active_color,
    default_selection_color,
    is_toplevel,
    is_darkbg,
}: RenderOptions) {
    return `
:root {
  --dark-background-light-text-add-on-foreground-color: ${default_foreground_color} !important;
  --dark-background-light-text-add-on-background-color: ${default_background_color} !important;
  --dark-background-light-text-add-on-link-color: ${default_link_color} !important;
  --dark-background-light-text-add-on-visited-color: ${default_visited_color} !important;
  --dark-background-light-text-add-on-active-color: ${default_active_color} !important;
  --dark-background-light-text-add-on-selection-color: ${default_selection_color} !important;
}

html {
${is_toplevel ? `\
  background-color: ${default_background_color};
` : ''}\
  color: ${default_foreground_color};
}

*:link,
*:link * {
  color: ${default_link_color} !important;
}

*:visited,
*:visited * {
  color: ${default_visited_color} !important;
}

input[type="range"] {
  -moz-appearance: none;
}

button,
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
textarea,
select,
[contenteditable="true"] {
  -moz-appearance: none !important;
  color: ${default_foreground_color} !important;
  background-color: ${default_background_color};
  border-radius: 4px;
  border-width: 1px;
  border-color: ${default_foreground_color};
  border-style: solid;
  transition-duration: 0.3s;
  transition-property: border-color, box-shadow;
}

input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="color"]):not([type="image"]):not([type="reset"]):not([type="submit"]),
textarea,
[contenteditable="true"] {
  background-image: none !important;
}

input:focus:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="color"]):not([type="image"]):not([type="reset"]):not([type="submit"]),
textarea:focus,
[contenteditable="true"]:focus {
  box-shadow: inset 0 0 0.15em 0.15em ${default_selection_color} !important;
  border-color: ${default_selection_color} !important;
}

button,
input[type="button"],
input[type="color"],
input[type="image"],
input[type="reset"],
input[type="submit"],
select {
  box-shadow: 0 0 0.15em 0.15em transparent !important;
}

button:focus,
input[type="button"]:focus,
input[type="color"]:focus,
input[type="image"]:focus,
input[type="reset"]:focus,
input[type="submit"]:focus,
select:focus {
  box-shadow: 0 0 0.15em 0.15em ${default_selection_color} !important;
  border-color: ${default_selection_color} !important;
}

select {
  background-image: url('data:image/svg+xml;utf8,<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><path stroke="${encodeURIComponent(default_foreground_color)}" fill="transparent" stroke-width="40" d="M 100 175 L 250 350 L 400 175"/></svg>') !important;
  background-position: right center !important;
  background-repeat: no-repeat !important;
  padding-right: 1em !important;
  background-size: 1em !important;
}

*::-moz-selection {
  color: ${default_foreground_color} !important;
  background: ${default_selection_color} !important;
  text-shadow:
    ${default_background_color} 0 0 1pt,
    ${default_background_color} 0 0 2pt,
    ${default_background_color} 0 0 3pt,
    ${default_background_color} 0 0 4pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt !important;
}

${''/* TODO: "black on transparent" mark */}\
${is_darkbg ? `\
img[alt="inline_formula"],
.mwe-math-fallback-image-inline,
${''/* charts, for example on https://addons.mozilla.org/en-US/firefox/addon/black-background-white-text/statistics/ */}\
.highcharts-container {
  filter: invert(1) hue-rotate(180deg) !important;
}
` : ''}\

${''/* https://catalog.onliner.by/ */}\
${is_darkbg ? `\
.catalog-content .i-checkbox__faux::before {
  filter: invert(1);
}
` : ''}\

${''/* #8 google scholar bars on right sidebar */}\
#gs_bdy #gsc_g_bars .gsc_g_a[style*="height"] {
  background-color: rgb(119, 119, 119) !important;
}

${''/* https://github.com/qooob/authentic-theme radio buttons. unfortunately, there is no public available demo */}\
.awradio label::after {
  background-color: ${default_foreground_color} !important;
}

${''/* buttons on many google services (Books, Translate, etc) */}\
${is_darkbg ? `\
.jfk-button-img {
  filter: invert(1);
}
` : ''}\
`;
}

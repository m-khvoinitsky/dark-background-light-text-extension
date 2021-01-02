import { RenderOptions } from '../../common/types';
export const name = 'stylesheet-processor';
export function render({
    default_foreground_color,
    default_background_color,
    default_link_color,
    default_visited_color,
    default_active_color,
    is_toplevel,
}: RenderOptions) {
    return `
html {
${''/* some webpages set html's bgcolor to transparent which is becomes white so it should be !important */}\
${is_toplevel ? `\
  background-color: ${default_background_color} !important;
` : ''}\
${''/* #29 */}\
  color: ${default_foreground_color} !important;
}

${''/*Legacy Attributes*/}\
[bgcolor] {
  background-color: ${default_background_color} !important;
}
[text],
[color] {
  color: ${default_foreground_color} !important;
}

[alink]:link:active {
  color: ${default_active_color} !important;
}
[vlink]:visited {
  color: ${default_visited_color} !important;
}
[link]:link {
  color: ${default_link_color} !important;
}
${''/*Legacy Attributes*/}\

${''/*Bittorrent sync webui fix*/}\
.qrCode > canvas {
  border: 10px white solid;
}

@-moz-document url-prefix("https://davdroid.bitfire.at/") {
${''/* fix for huge white peace due to "border-left: 68px solid #EDEDED;" */}\
  article {
    border-left-color: #000000 !important;
  }
}
`;
}

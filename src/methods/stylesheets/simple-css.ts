import { RenderOptions } from '../../common/types';
export const name = 'simple-css';
export function render({
    default_foreground_color,
    default_background_color,
}: RenderOptions) {
    return `
* {
  color: ${default_foreground_color} !important;
}

*:not(.colorpickertile):not(.colorpicker-button-colorbox) {
  background-color: ${default_background_color} !important;
}

a *,
button *,
input *,
optgroup *,
select *,
textarea * {
  background-color: transparent !important;
  text-shadow:
    ${default_background_color} 0 0 1pt,
    ${default_background_color} 0 0 2pt,
    ${default_background_color} 0 0 3pt,
    ${default_background_color} 0 0 4pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt !important;
}
a,
button,
input,
optgroup,
select,
textarea {
  text-shadow:
    ${default_background_color} 0 0 1pt,
    ${default_background_color} 0 0 2pt,
    ${default_background_color} 0 0 3pt,
    ${default_background_color} 0 0 4pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt,
    ${default_background_color} 0 0 5pt !important;
}
`;
}

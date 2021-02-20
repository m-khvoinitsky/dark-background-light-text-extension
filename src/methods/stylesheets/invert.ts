import { RenderOptions } from '../../common/types';

export const name = 'invert';
// eslint-disable-next-line no-empty-pattern
export function render({}: RenderOptions) {
    return `
@supports (backdrop-filter: invert(1)) {
  #mybpwaycfxccmnp-dblt-backdrop-filter {
    display: block !important;
    position: fixed !important;
    top: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    margin: 0 !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    backdrop-filter: invert(1) hue-rotate(180deg) !important;
  }
  img:not(.mwe-math-fallback-image-inline):not([alt="inline_formula"]),
  video {
    filter: invert(1) hue-rotate(180deg) !important;
  }
}

@supports not (backdrop-filter: invert(1)) {
  html,
${''/* TODO: "black on transparent" mark */}\
  img:not(.mwe-math-fallback-image-inline):not([alt="inline_formula"]),
  video,
  div#viewer.pdfViewer div.page {
    filter: invert(1) hue-rotate(180deg) !important;
  }
${''/* #28 */}\
  :fullscreen video,
  video:fullscreen {
    filter: none !important;
  }

  html {
    background-color: black !important;
  }
}

button,
input,
optgroup,
select,
textarea {
  background-color: white;
  color: black;
}
`;
}

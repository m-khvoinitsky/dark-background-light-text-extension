<script lang="ts" context="module">
  let global_i = 0;
</script>

<script lang="ts">
  import { parseCSSColor } from 'csscolorparser-ts';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { strip_alpha } from '../common/color_utils';
  import type { RGBA } from '../common/types';

  const local_i = global_i++;

  const css_keywords = ['aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque','black','blanchedalmond','blue','blueviolet','brown','burlywood','cadetblue','chartreuse','chocolate','coral','cornflowerblue','cornsilk','crimson','cyan','darkblue','darkcyan','darkgoldenrod','darkgray','darkgreen','darkgrey','darkkhaki','darkmagenta','darkolivegreen','darkorange','darkorchid','darkred','darksalmon','darkseagreen','darkslateblue','darkslategray','darkslategrey','darkturquoise','darkviolet','deeppink','deepskyblue','dimgray','dimgrey','dodgerblue','firebrick','floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite','gold','goldenrod','gray','green','greenyellow','grey','honeydew','hotpink','indianred','indigo','ivory','khaki','lavender','lavenderblush','lawngreen','lemonchiffon','lightblue','lightcoral','lightcyan','lightgoldenrodyellow','lightgray','lightgreen','lightgrey','lightpink','lightsalmon','lightseagreen','lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow','lime','limegreen','linen','magenta','maroon','mediumaquamarine','mediumblue','mediumorchid','mediumpurple','mediumseagreen','mediumslateblue','mediumspringgreen','mediumturquoise','mediumvioletred','midnightblue','mintcream','mistyrose','moccasin','navajowhite','navy','oldlace','olive','olivedrab','orange','orangered','orchid','palegoldenrod','palegreen','paleturquoise','palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue','purple','rebeccapurple','red','rosybrown','royalblue','saddlebrown','salmon','sandybrown','seagreen','seashell','sienna','silver','skyblue','slateblue','slategray','slategrey','snow','springgreen','steelblue','tan','teal','thistle','tomato','turquoise','violet','wheat','white','whitesmoke','yellow','yellowgreen'];

  let class_: string | undefined;
  export { class_ as class };
  export let value: string;
  let default_: string;
  export { default_ as default };

  let color: HTMLInputElement;
  let text: HTMLInputElement;

  let common_value = writable('');

  let color_value: string;
  $: color_value = value;
  let text_value: string;
  $: text_value = value;

  let shake_it = false;
  let is_wrong = false;
  let text_class: string;
  $: text_class = [
    ...(text_value.startsWith('#') ? ['uppercase'] : []),
    ...(shake_it ? ['headShake'] : []),
    ...(is_wrong ? ['is-wrong'] : []),
  ].join(' ');

  function compare_RGBA(c1: RGBA | null, c2: RGBA | null): boolean {
    return !!c1 && !!c2 && c1[0] == c2[0] && c1[1] == c2[1] && c1[2] == c2[2] && c1[3] == c2[3];
  }

  onDestroy(common_value.subscribe(val => {
    color_value = val;
    if (text_value && val && !compare_RGBA(parseCSSColor(text_value), parseCSSColor(val))) {
      text_value = val;
    }
  }))

  $: common_value.update(() => color_value)
  $: {
    let parsed: RGBA | null = parseCSSColor(text_value);
    if (parsed) {
      common_value.update(() => to_hex_color(parsed!));
      is_wrong = false;
    } else {
      is_wrong = true;
    }
  }

  function to_hex_color(a: RGBA): string {
    return `#${strip_alpha(a).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }

  const dispatch = createEventDispatcher();
  function emit(is_text: boolean) {
    let new_value: string;
    if (is_text) {
      let parsed = parseCSSColor(text_value);
      if (parsed) {
        new_value = to_hex_color(parsed);
      } else {
        new_value = default_;
        text_value = new_value;
        shake_it = true;
      }
    } else {
      new_value = color_value;
    }
    dispatch('change', { value: new_value });
  }
</script>

<div class="{class_}">
  <input bind:this={color} bind:value={color_value} type="color" on:change="{() => emit(false)}">
  <input bind:this={text} bind:value={text_value} type="text" on:change="{() => emit(true)}"
         class="{text_class}" list="css-colors"
         on:animationend="{() => (shake_it = false)}">
  {#if local_i === 0 }
    <datalist id="css-colors">
      {#each css_keywords as kw}
        <option value="{kw}">
      {/each}
    </datalist>
  {/if}
</div>

<style>
  div {
    display: flex;
  }
  input {
    width: 50%;
  }
  .uppercase {
    text-transform: uppercase;
  }
  input:first-child {
    /* same as margin-top in .row in bootstrap grid */
    margin-right: 0.2em;
  }
  input[type="text"] {
    transition: border-color box-shadow 2s;

  }
  input:focus {
    outline: none;
  }
  .is-wrong:not(#xhodwxsxaj) {
    border-color: red !important;
  }
  .is-wrong:not(#xhodwxsxaj):focus {
    box-shadow: inset 0 0 0.15em 0.15em red !important;
  }

  /* based on https://github.com/animate-css/animate.css/blob/main/source/attention_seekers/headShake.css */
  @keyframes headShake {
    0% {
      transform: translateX(0);
    }
    6.5% {
      transform: translateX(-6px) rotateY(-9deg);
    }
    18.5% {
      transform: translateX(5px) rotateY(7deg);
    }
    31.5% {
      transform: translateX(-3px) rotateY(-5deg);
    }
    43.5% {
      transform: translateX(2px) rotateY(3deg);
    }
    50% {
      transform: translateX(0);
    }
  }
  .headShake {
    animation-timing-function: ease-in-out;
    animation-name: headShake;

    animation-duration: 0.7s;
    animation-fill-mode: both;
  }
</style>

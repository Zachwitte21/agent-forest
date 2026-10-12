/**
 * camp/tent.ts
 * A 3/4-view A-frame tent with an open door, guy ropes and a pennant.
 */

// Palette lives in custom properties so the two variants share every shape class.
export const CSS = `.te-a{--f:#e98a55;--s:#b85a35;--k:#6e3320;--l:#f6d3ae;--g:#f2c94c}
.te-b{--f:#7f9e6b;--s:#58764e;--k:#33452f;--l:#dfe6c4;--g:#e0714a}
.te-f{fill:var(--f)}.te-s{fill:var(--s)}.te-l{fill:var(--l)}.te-d{fill:#2a1d18}
.te-k,.te-n,.te-r,.te-o{fill:none;stroke-linecap:round;stroke-linejoin:round}
.te-k{stroke:var(--k);stroke-width:1.2}.te-n{stroke:var(--k);stroke-width:.7;opacity:.55}.te-o{stroke:var(--s);stroke-width:1.9}
.te-r{stroke:#7d6a50;stroke-width:.6}.te-sh{fill:#000;opacity:.16}
.te-g{fill:var(--g);transform-box:fill-box;transform-origin:0 50%;animation:te-w 2.4s ease-in-out infinite alternate}
@keyframes te-w{to{transform:scaleX(.72) skewY(-7deg)}}
@media (prefers-color-scheme:dark){.te-a{--f:#b9693f;--s:#82422a;--k:#d39466;--l:#c99a72}
.te-b{--f:#5e7a52;--s:#3f563a;--k:#98ae80;--l:#a4b48e}.te-d{fill:#4a2b16}.te-r{stroke:#a8957a}.te-sh{opacity:.4}}
@media (prefers-reduced-motion:reduce){.te-g{animation:none}}`;

export const DEFS = '';

export function draw(variant: 0 | 1, mirrored: boolean): string {
  return `<g class="te-${variant ? 'b' : 'a'}"${mirrored ? ' transform="scale(-1 1)"' : ''}>`
    + '<ellipse class="te-sh" cx="2" rx="32" ry="3.5"/>'
    + '<path class="te-r" d="M-12-36L-33 1M16-33L33 1"/>'
    + '<path class="te-s" d="M-12-36L16-33L27-2L2 0Z"/>'
    + '<path class="te-f" d="M-12-36L-28 0H2Z"/>'
    + '<path class="te-d" d="M-12-27L-19.5 0H-4Z"/>'
    + '<path class="te-l" d="M-12-27L-19.5 0H-23.5Q-20-13-12-27Z"/>'
    + '<path class="te-o" d="M-13-23Q-18.5-12-21.8-1"/>'
    + '<path class="te-n" d="M2-34.5L14.5-1M2-1.5L26.6-3.3M-27-1.4H1.3"/>'
    // Ridge, poles, pegs and the flap tie share one stroke so they cost one element.
    + '<path class="te-k" d="M-12-36L16-33M-12-36V-43M16-33V-36M-33 1V-2M33 1V-2M-20.2-12.5L-16.8-12"/>'
    + '<path class="te-g" d="M-12-43L-5-41.2L-12-39.4Z"/></g>';
}

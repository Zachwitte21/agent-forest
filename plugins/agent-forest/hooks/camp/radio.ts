/**
 * camp/radio.ts
 * A transistor radio on the ground between the fire and the lake; clicking it opens Claude FM.
 */

export const CSS: string =
  '.rd-b{fill:#c15f3c}.rd-e{fill:#9a4528}.rd-h{fill:none;stroke:#5b4636;stroke-width:1.6;stroke-linecap:round}.rd-a{stroke:#8d8a83;stroke-width:.9;stroke-linecap:round}.rd-t{fill:#d8d4c8}' +
  '.rd-s{fill:#3a2e26}.rd-g{stroke:#6e5a4a;stroke-width:.7}.rd-d{fill:#f3ead6}.rd-k{stroke:#a39c8e;stroke-width:.5}.rd-n{stroke:#c8483a;stroke-width:.8}.rd-o{fill:#3a2e26}.rd-sh{fill:#000;opacity:.18}' +
  '.rd-m{fill:#5b4636;opacity:0;animation:rdm 3.6s ease-out infinite}.rd-m2{animation-delay:1.8s}@keyframes rdm{15%{opacity:.8}to{opacity:0;transform:translate(5px,-16px)}}' +
  '@media (prefers-color-scheme:dark){.rd-b{fill:#a9502f}.rd-e{fill:#7c3820}.rd-h{stroke:#2b2117}.rd-d{fill:#d9cfb8}.rd-sh{opacity:.45}.rd-m{fill:#e9dcc0}}' +
  '@media (prefers-reduced-motion:reduce){.rd-m{animation:none;opacity:.6}}';

export const DEFS = '';

const NOTE = 'M0 0a1.6 1.2 0 1 0 1.6-1.2V-6l2.6 1V-6.4L.6-7.6V-1.2A1.6 1.2 0 0 0 0 0z';

/**
 * draw()
 * About 24 x 22 units, standing on y = 0, centred on x = 0.
 */
export function draw(): string {
  return (
    '<ellipse class="rd-sh" cy="1" rx="13" ry="2.6"/>' +
    '<path class="rd-a" d="M7-14L13-25"/><circle class="rd-t" cx="13" cy="-25" r="1"/>' +
    '<path class="rd-h" d="M-7-14Q-7-19 0-19Q7-19 7-14"/>' +
    '<rect class="rd-e" x="-11" y="-14" width="22" height="14.5" rx="2.6"/><rect class="rd-b" x="-11" y="-14.6" width="22" height="14" rx="2.6"/>' +
    '<circle class="rd-s" cx="-4.6" cy="-7.4" r="4.6"/><path class="rd-g" d="M-8-9.4h6.8M-8.6-7.4h8M-8-5.4h6.8"/>' +
    '<rect class="rd-d" x="1.6" y="-12" width="7.6" height="5" rx=".8"/><path class="rd-k" d="M2.8-8.4h5.2M3.4-10.6v1.2M5-10.6v1.2M6.6-10.6v1.2M8.2-10.6v1.2"/><path class="rd-n" d="M5.6-11.6v4.2"/>' +
    '<circle class="rd-o" cx="3.6" cy="-3.8" r="1.4"/><circle class="rd-o" cx="7.4" cy="-3.8" r="1.4"/>' +
    // The animation owns each note's transform, so the resting spot goes on a wrapping group.
    `<g transform="translate(-9 -17)"><path class="rd-m" d="${NOTE}"/></g><g transform="translate(-3 -19)"><path class="rd-m rd-m2" d="${NOTE}"/></g>`
  );
}

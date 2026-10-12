// Stump seat: all art lives in DEFS so 8 copies cost one <use> tag each.
export const CSS: string =
  '.st-b{fill:#8b5a33}.st-k{fill:none;stroke:#5e3a1f;stroke-width:.7}.st-t{fill:#e2bf86;stroke:#5e3a1f;stroke-width:.8}.st-r{fill:none;stroke:#bf9058;stroke-width:.5}.st-c{fill:#f6e0b0}.st-sh{fill:#000;opacity:.18}.st-mc{fill:#c8483a}.st-ms{fill:#f3ead6}.st-g{fill:#6f9a45}.st-f{transform:scale(-1,1)}' +
  '@media (prefers-color-scheme:dark){.st-b{fill:#6e4729}.st-k{stroke:#3a2414}.st-t{fill:#b8935f;stroke:#3a2414}.st-r{stroke:#8f6a40}.st-c{fill:#d3b27c}.st-sh{opacity:.45}.st-g{fill:#4f7335}}';

export const DEFS: string =
  '<g id="st-s"><ellipse class="st-sh" cy="1.2" rx="11" ry="2.8"/>' +
  '<path class="st-b" d="M-7-5V-1Q-7.6.2-9.6.9Q-5 1.9 0 1.7Q5 1.9 9.6.9Q7.6.2 7-1V-5ZM1 1.5q1.8.3 3.2 1.6q.4-1.3-.2-1.8z"/>' +
  '<path class="st-k" d="M-5-3.4v3.6M-2.4-3v4M1-3v3.6M4.2-3.2v4M6.2-3.6v3"/>' +
  '<ellipse class="st-t" cy="-5" rx="7" ry="2.4"/><ellipse class="st-r" cy="-5" rx="4.8" ry="1.6"/><ellipse class="st-r" cy="-4.9" rx="2.7" ry=".9"/>' +
  '<path class="st-r" d="M1.5-4.8l3.2.9"/><ellipse class="st-c" cy="-4.9" rx="1.1" ry=".4"/></g>' +
  '<g id="st-m"><use href="#st-s"/><path class="st-ms" d="M10 1.4v-2h1v2z"/><path class="st-mc" d="M8.8-.5a1.7 1.5 0 0 1 3.4 0z"/><circle class="st-ms" cx="10.9" cy="-1.3" r=".35"/></g>' +
  '<g id="st-g"><use href="#st-s"/><path class="st-g" d="M-7.4-4.6q1.7 1 3.6.3q.1 1.1-.7 1.5q-.4-.6-1.1-.2q-.6.9-1.8.2z"/></g>';

/**
 * draw(variant)
 * Odd variants mirror and every third adds a mushroom or moss, so the row of 8 does not look stamped.
 */
export function draw(variant: number): string {
  const v = variant | 0;
  return `<use href="#st-${'smg'[v % 3]}"${v % 2 ? ' class="st-f"' : ''}/>`;
}

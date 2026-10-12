/**
 * camp/log
 * One log seat for the campfire ring, drawn once in DEFS and stamped 13 times.
 */

export const CSS =
  '.lo-s{fill:#3a2a16;opacity:.28}.lo-u{fill:#6c4325}.lo-b{fill:#8a5a32}.lo-h{fill:#b37c4a}' +
  '.lo-g{fill:none;stroke:#5a3519;stroke-width:.8;stroke-linecap:round}.lo-k{fill:#5a3519}' +
  '.lo-e{fill:#ecd3a0;stroke:#6e4826;stroke-width:.6}.lo-r{fill:none;stroke:#bf965f;stroke-width:.5}.lo-m{fill:#5f8333}' +
  '@media (prefers-color-scheme: dark){.lo-s{fill:#000;opacity:.4}.lo-u{fill:#5c3820}.lo-b{fill:#7c4f2b}.lo-h{fill:#a06d40}' +
  '.lo-e{fill:#d7bb86}.lo-r{stroke:#a98352}.lo-m{fill:#5b7a2e}}';

// Ends sit at x=-13 and x=13.5 so the top highlight lands at y=-3.6, right under a seated character.
export const DEFS =
  '<g id="lo-a"><ellipse class="lo-s" cx="1" cy="5" rx="16" ry="2"/>' +
  '<rect class="lo-u" x="-13" y="-4" width="27" height="9" rx="4.5"/>' +
  '<rect class="lo-b" x="-13" y="-4" width="27" height="7" rx="3.5"/>' +
  '<rect class="lo-h" x="-11" y="-3.6" width="23" height="2" rx="1"/>' +
  '<path class="lo-g" d="M-7 .4h7M3 1.9h7M-9 2h3"/>' +
  '<ellipse class="lo-k" cx="7" cy="-.1" rx="1.3" ry=".9"/>' +
  '<ellipse class="lo-e" cx="-13" cy=".5" rx="3" ry="4.5"/>' +
  '<ellipse class="lo-r" cx="-13" cy=".5" rx="1.8" ry="2.8"/>' +
  '<circle class="lo-k" cx="-13" cy=".5" r=".6"/></g>' +
  '<g id="lo-c"><path class="lo-b" d="M11-1l5-3 1 1.6-5 2.4z"/><use href="#lo-a"/>' +
  '<path class="lo-m" d="M-3 4.6c1-1.6 3-1.8 4-.8 1-1 3.5-.8 4.5.8z"/></g>';

/**
 * draw(variant)
 * Every third log gets a stub and moss, and odd ones flip so the ring never repeats in step.
 */
export function draw(variant: number): string {
  const shape = variant % 3 === 2 ? 'c' : 'a';
  const flip = variant % 2 ? ' transform="scale(-1 1)"' : '';
  return `<use href="#lo-${shape}"${flip}/>`;
}

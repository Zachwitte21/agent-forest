/**
 * camp/clearing.ts
 * Trampled dirt clearing under the campfire and its log seats, in local coordinates around the fire.
 */

export const CSS = `.cg-o{fill:#a9c77f}.cg-x{fill:#c2b080;opacity:.55}.cg-i{fill:#c6a271}.cg-k{stop-color:#7a6048}.cg-a{fill:#a0958a;opacity:.5}.cg-p{fill:#9c958a}.cg-t{stroke:#7a5a3a;stroke-linecap:round}.cg-l{fill:#c8803a}.cg-g{fill:#5f8f3f}@media (prefers-color-scheme: dark){.cg-o{fill:#34452b}.cg-x{fill:#4a4232}.cg-i{fill:#463a2b}.cg-k{stop-color:#16120f}.cg-a{fill:#3e3a35}.cg-p{fill:#5d5850}.cg-t{stroke:#2b2117}.cg-l{fill:#6e4a26}.cg-g{fill:#2d3b25}}`;

export const DEFS = `<radialGradient id="cg-h"><stop offset=".45" class="cg-k"/><stop offset="1" class="cg-k" stop-opacity="0"/></radialGradient><path id="cg-u" d="M-4 0l1-6 2 4 1-7 1 7 2-4 1 6z"/>`;

const f = (n: number) => +n.toFixed(1);

export function draw(rx: number, ry: number): string {
  // Seeded so the scene is identical on every render.
  let s = 9;
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const k = rx / 150;

  // Wobbly closed ring, smoothed by curving through midpoints of jittered polar points.
  // Ragged, uneven edges: many points, each pushed in or out at random, so neither ring reads as a drawn ellipse.
  const blob = (a: number, b: number, j: number, n = 22) => {
    const p: number[][] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 6.283, m = 1 - j + R() * j * 2;
      p.push([a * m * Math.cos(t), b * m * Math.sin(t)]);
    }
    const mid = (i: number) => {
      const q = p[i % n], r = p[(i + 1) % n];
      return f((q[0] + r[0]) / 2) + ' ' + f((q[1] + r[1]) / 2);
    };
    let d = 'M' + mid(0);
    for (let i = 1; i <= n; i++) d += 'Q' + f(p[i % n][0]) + ' ' + f(p[i % n][1]) + ' ' + mid(i);
    return d + 'Z';
  };

  // Outside: grass worn pale by feet, out past the outer logs. Inside: bare dirt around the fire and the inner logs.
  let o = `<path class="cg-o" d="${blob(rx * 1.24, ry * 1.52, 0.11)}"/>`;
  for (let i = 0; i < 26; i++) {
    const t = R() * 6.283, r = 0.8 + R() * 0.38;
    o += `<ellipse class="cg-x" cx="${f(rx * r * Math.cos(t))}" cy="${f(ry * 1.2 * r * Math.sin(t))}" rx="${f((3 + R() * 5) * k)}" ry="${f((1.4 + R() * 2) * k)}"/>`;
  }
  o += `<path class="cg-i" d="${blob(rx * 0.76, ry * 0.92, 0.14)}"/>`;


  // Scorch and ash under the fire.
  o += `<ellipse fill="url(#cg-h)" rx="${f(rx * 0.36)}" ry="${f(ry * 0.42)}"/><ellipse class="cg-a" rx="${f(rx * 0.13)}" ry="${f(ry * 0.15)}"/>`;

  // Pebbles and leaves are circles in a squashed group, which flattens them onto the ground for free.
  let a = `<g class="cg-p" transform="scale(1 .5)">`, b = `<g class="cg-t" stroke-width="${f(1.3 * k)}">`;
  for (let i = 0; i < 18; i++) {
    const t = R() * 6.283, r = 0.3 + R() * 0.42;
    const x = f(rx * r * Math.cos(t)), y = ry * r * Math.sin(t);
    if (i < 15) a += `<circle${i > 11 ? ' class="cg-l"' : ''} cx="${x}" cy="${f(y * 2)}" r="${f((i > 11 ? 3 : 1.2 + R() * 1.6) * k)}"/>`;
    else b += `<path d="M${x} ${f(y)}l${f(9 * k)} ${f((R() - 0.5) * 4 * k)}"/>`;
  }
  o += a + '</g>' + b + '</g>';

  // Grass tufts at the outer edge, and a few creeping onto the dirt.
  o += `<g class="cg-g" transform="scale(${+k.toFixed(2)})">`;
  for (let i = 0; i < 16; i++) {
    const t = (i / 16 + R() * 0.04) * 6.283, e = i % 3 ? 1.22 : 0.76, ey = i % 3 ? 1.5 : 0.92;
    o += `<use href="#cg-u" x="${f((rx * e * Math.cos(t)) / k)}" y="${f((ry * ey * Math.sin(t) + 2) / k)}"/>`;
  }
  return o + '</g>';
}

// Campfire: stone ring, split logs, layered flickering flames, rising embers and a ground glow.

export const CSS =
  `.fi-g{fill:url(#fi-gw);opacity:.75}.fi-h{fill:url(#fi-gw);opacity:.3}` +
  `.fi-s{fill:url(#fi-st);stroke:#6f695f;stroke-width:.6}.fi-a{stop-color:#dcd6c8}.fi-b{stop-color:#878074}` +
  `.fi-l rect{fill:#7b4a28;stroke:#4a2a14;stroke-width:.6}.fi-l path{fill:none;stroke:#4f2c16;stroke-width:.7}` +
  `.fi-l ellipse{fill:#efd29c;stroke:#b8864f;stroke-width:.7}` +
  `.fi-f{transform-box:fill-box;transform-origin:50% 100%;animation:fi-x 1.3s ease-in-out infinite alternate}` +
  `.fi-o{fill:#ee6a25}.fi-m{fill:#fdb52f;animation-name:fi-y;animation-duration:.9s}.fi-i{fill:#fff4c4;animation-duration:.7s}` +
  `.fi-e{fill:#ffc94f;animation:fi-r 2.4s ease-out infinite}` +
  `@keyframes fi-x{to{transform:scale(.92,1.07) skewX(4deg)}}` +
  `@keyframes fi-y{to{transform:scale(1.07,.9) skewX(-5deg)}}` +
  `@keyframes fi-r{from{transform:none;opacity:1}to{transform:translate(3px,-30px);opacity:0}}` +
  `@media (prefers-color-scheme:dark){.fi-g{opacity:1}.fi-h{opacity:.55}.fi-s{stroke:#1f1e1b}.fi-a{stop-color:#79756c}.fi-b{stop-color:#383632}` +
  `.fi-l rect{fill:#603a20;stroke:#2a170a}.fi-l ellipse{fill:#d9b47a}}` +
  `@media (prefers-reduced-motion:reduce){.fi-f,.fi-e{animation:none}}`;

export const DEFS =
  `<radialGradient id="fi-gw"><stop offset="0" stop-color="#ffb33a" stop-opacity=".85"/><stop offset="1" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="fi-st" x1=".3" x2=".6" y2="1"><stop class="fi-a" offset=".15"/><stop class="fi-b" offset="1"/></linearGradient>`;

const r = (n: number) => Math.round(n * 10) / 10;

// Stones as [angle deg, rx, ry]; the back half sits behind the logs, the front half over them.
const STONES: [number, number, number][] = [
  [200, 6, 3.8], [236, 6.6, 4], [270, 5.6, 3.6], [304, 6.4, 4.1], [340, 6, 3.7],
  [20, 6.8, 4.4], [55, 7.2, 4.6], [90, 6.4, 4.2], [125, 7, 4.5], [160, 6.6, 4.3],
];

// Logs as [rotation, length, cut end on the right].
const LOGS: [number, number, boolean][] = [[-4, 46, false], [20, 54, false], [-20, 54, true], [7, 38, true]];

export function draw(now: number): string {
  const t = now / 1000;
  // Negative delay keyed to wall clock so a redraw lands mid-cycle instead of restarting.
  const d = (period: number, off = 0) => `style="animation-delay:${r(-((t + off) % period))}s"`;

  const stones = (list: [number, number, number][]) =>
    `<g class="fi-s">` +
    list
      .map(([a, rx, ry]) => {
        const rad = (a * Math.PI) / 180;
        return `<ellipse cx="${r(28 * Math.cos(rad))}" cy="${r(7 * Math.sin(rad) - 1)}" rx="${rx}" ry="${ry}"/>`;
      })
      .join('') +
    `</g>`;

  const logs = LOGS.map(([rot, len, right]) => {
    const h = len / 2;
    return `<g transform="rotate(${rot} 0 -6)"><rect x="${-h}" y="-10" width="${len}" height="8" rx="3"/><path d="M${5 - h} -7.5h${r(len * 0.55)}M${9 - h} -4.5h${r(len * 0.5)}"/><ellipse cx="${right ? h : -h}" cy="-6" rx="2.4" ry="4"/></g>`;
  }).join('');

  const ember = (x: number, y: number, off: number) => `<circle class="fi-e" cx="${x}" cy="${y}" r="1.1" ${d(2.4, off)}/>`;

  return (
    `<ellipse class="fi-g" cy="-2" rx="38" ry="12"/><circle class="fi-h" cy="-28" r="30"/>` +
    stones(STONES.slice(0, 5)) +
    `<g class="fi-l">${logs}</g>` +
    `<path class="fi-f fi-o" ${d(2.6)} d="M-15 -6C-20 -18 -12 -26 -9 -36C-7 -30 -5 -29 -4 -32C-5 -42 -1 -50 2 -60C5 -48 13 -42 10 -31C13 -33 15 -37 14 -42C20 -31 21 -16 15 -6Q0 1 -15 -6Z"/>` +
    `<path class="fi-f fi-m" ${d(1.8, 0.3)} d="M-10 -6C-14 -15 -7 -21 -5 -30C-3 -25 -1 -26 0 -29C1 -36 3 -40 4 -46C9 -36 13 -26 10 -6Q0 -1 -10 -6Z"/>` +
    `<path class="fi-f fi-i" ${d(1.4, 0.5)} d="M-5 -6C-7 -13 -2 -18 0 -26C3 -18 7 -13 5 -6Q0 -3 -5 -6Z"/>` +
    ember(-6, -38, 0) + ember(4, -46, 0.7) + ember(9, -34, 1.3) + ember(-1, -50, 1.9) +
    stones(STONES.slice(5))
  );
}

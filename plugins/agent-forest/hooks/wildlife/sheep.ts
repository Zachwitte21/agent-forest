/**
 * wildlife/sheep.ts
 * A band of bighorn sheep, a ram and two ewes, picking along a ledge on the far slopes.
 */

import type { World } from './types'

/** One loop of the walk, in seconds; the CSS durations below must match. */
const PERIOD = 200
/** Each ewe trails the ram by this many seconds, so they stop and graze out of step. */
const LAG = [0, 2, 3.5]
/** Where each sheep stands relative to the ram, a little lower and behind on the same diagonal. */
const OFFSET = [[0, 0], [-20, 3], [-39, 5]]
/** How far up from the horizon the ledge sits, as a share of the mountains' height; clear of the treeline spires. */
const LEDGE = 0.13

// One timeline, starting at the low end facing right: translate walks the route, scale turns them around at the top
// and again just before the loop wraps, and --g turns the far legs on for each walk.
const MOVE =
  '19%,99%{translate:0;--g:0}24%,37%{translate:16px -3px;--g:0}42%,59%{translate:36px -8px;--g:0}64%,75%{translate:58px -9px;--g:0}' +
  '81%,93%{translate:30px -4px;--g:0}19.2%,23.8%,37.2%,41.8%,59.2%,63.8%,75.2%,80.8%,93.2%,98.8%{--g:1}73.99%{scale:1}74%,99.99%{scale:-1 1}'
// The head dips to graze at most stops and lifts for a long look around from the rise.
const HEAD = '.6%,18.6%,28%,36.4%,65%,73.4%,82%,92.4%{rotate:85deg}18.9%,27.5%,36.8%,47%,53%,64.5%,73.8%,81.5%,92.8%{rotate:0deg}48%,52%{rotate:-18deg}'

export const CSS =
  `.bh-b{fill:#864}.bh-w{fill:#ffe}.bh-l{stroke:#432}` +
  // Ewes carry short spikes, cut from the ram's curl with a dash.
  `.bh-k{fill:none;stroke:#cb9;stroke-width:var(--k,.5);stroke-dasharray:var(--h,2 9)}` +
  `.bh-m{animation:bh-m ${PERIOD}s var(--d) infinite}.bh-h{transform-origin:2px -5px;animation:bh-h ${PERIOD}s var(--d) infinite}` +
  // Far legs only show while walking, so a resting sheep keeps its two-legged profile.
  `.bh-s{stroke:#321;opacity:var(--g,0);transform-origin:0 -3px;animation:bh-s .6s infinite alternate}` +
  `@keyframes bh-m{${MOVE}}@keyframes bh-h{${HEAD}}@keyframes bh-s{from{transform:skew(25deg)}to{transform:skew(-25deg)}}` +
  `@media (prefers-reduced-motion:reduce){.bh-m,.bh-h,.bh-s{animation:none}}` +
  `@media (prefers-color-scheme:dark){.bh-b{fill:#654}.bh-w{fill:#cbb}.bh-l{stroke:#322}.bh-k{stroke:#998}}`

// Drawn facing right with the hooves on y = 0; the ram reuses the ewe at a larger size with heavy horns.
export const DEFS =
  `<g id="bh-e"><path class="bh-l bh-s" d="M-2-3v3M3-3v3"/><path class="bh-l" d="M-3-3v3M2-3v3"/>` +
  `<ellipse class="bh-b" cy="-4" rx="3.9" ry="1.7"/><path class="bh-w" d="M-3.9-4q0-1.2.8-1.5l.1 3.2q-.9-.5-.9-1.7z"/>` +
  `<g class="bh-h"><path class="bh-b" d="M1.4-5l1.9-2.3 1.2-.2 1.7 1.1-.1.7-1.3.2-1 .6-.6 1.6z"/>` +
  `<path class="bh-w" d="M5.4-6.8l.8.4-.2.6-.8.1z"/><path class="bh-k" d="M3.9-7.3c-1-.9-2.4-.4-2.2.9.1.9 1.3 1 1.7.3"/></g></g>` +
  `<use id="bh-r" href="#bh-e" transform="scale(1.15)" style="--k:1.2;--h:0"/>`

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * draw(w)
 * The band in the gap left of the middle of the range, where the back row of trees usually leaves rock showing.
 */
export function draw(w: World): string {
  const H = (w.horizon - w.peaks) / 0.88
  const x = r1(w.W * 0.25), y = r1(w.horizon - H * LEDGE)
  const P = PERIOD * 1000
  const sheep = LAG.map((lag, i) => {
    const d = -((((w.now - lag * 1000) % P) + P) % P) / 1000
    const use = `<use class="bh-m" href="#bh-${i ? 'e' : 'r'}" style="--d:${r1(d)}s"/>`
    return i ? `<g transform="translate(${OFFSET[i].join(' ')})">${use}</g>` : use
  })
  return `<g transform="translate(${x} ${y})">${sheep.join('')}</g>`
}

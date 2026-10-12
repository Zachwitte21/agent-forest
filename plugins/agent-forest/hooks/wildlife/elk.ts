/**
 * wildlife/elk.ts
 * A bull and a cow elk grazing the meadow as a loose herd, each on its own slow loop of graze, look, walk and lie down.
 */

import type { World } from './types'

const PERIOD = 180000
// The cow runs the same timeline 8% behind the bull, so she follows him from stop to stop instead of moving in step.
const LAG = [0, 0.08]

// Both elk share one pose timeline in percent of the period, so only the route keyframes are per elk.
// Walks: S0 to S1, S1 to S2, then S2 back to S0; lying at S1 from 27% to 48%.
const T = { a0: 19, a1: 23, b0: 66, b1: 70, c0: 87, c1: 93 }

// Grazing: neck down to the grass, head tipped back up so the antlers still rise instead of pointing forward.
const GRAZE = '0%,6%,14%,54.5%,62%,71%,77%,82%,94%,100%'
const HEAD = '0%,14%,54.5%,62%,71%,82%,94%,100%'
// Brief lifts inside each graze, as the elk crops a mouthful and chews.
const CROP = '3%,10%,58%,74%,79%,97%'

export const CSS =
  `.ek-c{fill:#c96}.ek-k{fill:#a74}.ek-l{fill:#532}.ek-q{fill:#321}.ek-r{fill:#edb}.ek-a{fill:none;stroke:#a86;stroke-width:1.6;opacity:var(--b,1)}.ek-o{opacity:.15}` +
  `@media (prefers-color-scheme:dark){.ek-c{fill:#764}.ek-k{fill:#653}.ek-l{fill:#322}.ek-q{fill:#211}.ek-r{fill:#a98}.ek-a{stroke:#654}}` +
  `.ek-g{--A:${PERIOD / 1000}s var(--t) infinite}.ek-x{animation:ek-x var(--A) step-end}.ek-f{animation:ek-f var(--A)}.ek-d{animation:ek-d var(--A)}` +
  `.ek-n{animation:ek-n var(--A);transform-origin:8px -21px}.ek-h{animation:ek-h var(--A);transform-origin:16px -38px}` +
  `.ek-s,.ek-z{animation:ek-s .5s var(--t) infinite alternate;transform-box:fill-box;transform-origin:top}.ek-z{animation-direction:alternate-reverse}` +
  `.ek-T{animation:ek-T 10s var(--t) infinite;transform-origin:-15px -23px}` +
  // The walk gate --a is a discrete custom property, so the legs only swing while the route keyframes are moving.
  `@keyframes ek-x{0%{scale:-1 1}${T.a0}%{--a:9deg;scale:1}${T.a1}%,${T.b1}%,${T.c1}%{--a:0}${T.b0}%{--a:9deg}${T.c0}%{--a:9deg;scale:-1 1}}` +
  `@keyframes ek-s{from{rotate:calc(-1*var(--a,0deg))}to{rotate:var(--a,0deg)}}` +
  `@keyframes ek-n{${GRAZE}{rotate:92deg}${CROP}{rotate:86deg}15.5%,18%,23.5%,53%,63.5%,65%,83.5%,86%{rotate:-8deg}20%,22%,66%,69%,87%,92%{rotate:15deg}}` +
  `@keyframes ek-h{${HEAD}{rotate:-45deg}15.5%,53%,63.5%,69%,83.5%,92%{rotate:0deg}}` +
  `@keyframes ek-d{25%,50%{translate:0}27%,48%{translate:0 10.5px}}` +
  `@keyframes ek-f{25%,50%{scale:1}27%,48%{scale:1 .2}}` +
  `@keyframes ek-T{92%{rotate:0deg}95%{rotate:30deg}}` +
  `@media (prefers-reduced-motion:reduce){.ek-g{--t:0s!important}[class*=ek-]{animation-play-state:paused}}`

// Near and far antler share one relative path, so the far one is just a different start point.
const ANTLER = 'c-1-7-5-12-11-15m10.5 12.6l5-1.5m-5.8-1l4.5-2.5m-6.8-1.6l3.5-5.5m-6.8 2.1l1.5-5'

// One whole elk, facing right with the hooves on y = 0. Its parts animate inside the <use> on the --A timing it inherits.
export const DEFS =
  `<g id="ek-E" class="ek-x"><ellipse class="ek-o" rx="17" ry="2.5"/>` +
  `<g class="ek-f"><path class="ek-q ek-z" d="M6-15h2.4l-.3 15h-1.8z"/><path class="ek-q ek-s" d="M-10-16h3.5l-1 7 .3 9h-1.8l-.6-8z"/>` +
  `<path class="ek-l ek-s" d="M9-15h2.4l-.3 15h-1.8z"/><path class="ek-l ek-z" d="M-13-16h3.5l-1 7 .3 9h-1.8l-.6-8z"/></g>` +
  `<g class="ek-d"><path class="ek-c" d="M6-27q-12 0-18 2q-5 2-4.5 7q.5 4 4.5 5q10-1 18 0q6 0 7-5q0-6-7-9z"/><path class="ek-k" d="M-15.5-16q8 2 28-1q-1 4-7 4q-8-1-18 0q-2.5-.5-3-3z"/>` +
  `<path class="ek-r" d="M-10-25.5q-6 0-6.5 7q0 4 3 5q2-6 3.5-12z"/><path class="ek-k ek-T" d="M-15-23l-1.8 3.2 1.5.3z"/>` +
  // Thick neck held up at about 45 degrees, shaggy mane under the throat, then a long lighter head with an upright ear.
  `<g class="ek-n"><path class="ek-l" d="M4-27q5-8 10.5-12l3 4.5q-3 6-4.5 13l-1 2.5q-5-1-8-8z"/><path class="ek-q" d="M17-33l1.5 4-1 .5.8 3.5-1.3.5.2 4-1.7.5-.5 2.5-2-1L13-27z"/>` +
  `<g class="ek-h"><path class="ek-a" d="M18-39.5${ANTLER}M15.8-40.5${ANTLER}"/><path class="ek-k" d="M15.5-40.5l8.5 8q1.5 1.8-.2 2.8l-1.5.3q-3.5-1.5-5.5-3.6q-2-1-3-3.5zm0 1q-3-3-2.5-6.5q2 2 2.5 5.5z"/>` +
  `<path class="ek-q" d="M17.6-38.2h1.1v1h-1.1zM23.6-31.4l1 .6-.4 1-1-.2z"/></g></g></g></g>`

// Drawn 40% over life size against the Claudes so the herd reads from across the pane.
const SIZE = [1.4, 1.29]
// Herd centre as a fraction across the meadow: left of the trail, away from the grizzly and the marmot burrows.
const HERD_X = 0.25
const HERD_SIDES = [HERD_X, 0.72, 0.5]
// Each elk's three stops around the centre, x in px at a 1267 px wide pane, y in px.
// The cow keeps about 55 px nearer the camp, which (checked across the whole loop with her lag) keeps the two silhouettes apart.
const ROUTES: [number, number][][] = [
  [[-84, -22], [0, -8], [84, -31]],
  [[-140, 31], [-56, 39], [56, 25]],
]
const REACH = 25

const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => String(Math.round(n * 100) / 100).replace(/^0\./, '.')

/** Each elk on its own, with the ground y it stands on, so a bull behind a tree and a cow in front of it both layer right. */
export function drawParts(w: World): Array<{ y: number; svg: string }> {
  const m = w.meadow
  const k = Math.min(1, Math.max(0.5, w.W / 1267))
  const cy = (m.y0 + m.y1) / 2
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let cx = m.x0 + (m.x1 - m.x0) * HERD_X
  const stops = (ox: number, oy: number) => ROUTES.map(r => r.map(([dx, dy]) => ({ x: cx + ox + dx * k, y: cy + oy + dy })))
  const inside = (p: { x: number; y: number }) => p.x > m.x0 + 30 && p.x < m.x1 - 30 && p.y > m.y0 + 6 && p.y < m.y1 - 4
  const fits = (p: { x: number; y: number }) => inside(p) && w.isClear(p.x, p.y, REACH * w.depth(p.y))
  // Spiral the whole herd out from its planned centre until every stop is clear, so the spacing between the two never changes.
  // A small repo's trees can fill the herd's usual side of the meadow, so the other side and the middle get a turn too.
  // When nowhere fits every stop (a crowded small-repo meadow), the spot where the most stops are clear wins rather than the planned centre.
  let herd = stops(0, 0)
  let best = -1
  search: for (const side of HERD_SIDES) {
    cx = m.x0 + (m.x1 - m.x0) * side
    for (let i = 0; i < 120; i++) {
      const a = rnd() * 6.28, d = i * 2.5
      const h = stops(Math.cos(a) * d, Math.sin(a) * d * 0.4)
      // Never half off the picture, however crowded it is.
      if (!h.flat().every(inside)) continue
      const clear = h.flat().filter(fits).length
      if (clear > best) {
        best = clear
        herd = h
      }
      if (clear === h.flat().length) break search
    }
  }
  return herd.map((s, i) => {
    const at = (p: { x: number; y: number }) => `{translate:${r0(p.x)}px ${r0(p.y)}px;scale:${r2(w.depth(p.y) * SIZE[i])}}`
    // The shared timeline faces right for the first two walks and left for the last, so stops run left to right.
    const css = `@keyframes ek-m${i}{0%,${T.a0}%,${T.c1}%,100%${at(s[0])}${T.a1}%,${T.b0}%${at(s[1])}${T.b1}%,${T.c0}%${at(s[2])}}`
    const phase = (((w.now - LAG[i] * PERIOD) % PERIOD) + PERIOD) % PERIOD
    const svg = `<style>${css}</style><use href="#ek-E" class="ek-g" style="--t:${-Math.round(phase / 100) / 10}s;animation:ek-m${i} var(--A)${i ? ';--b:0' : ''}"/>`
    return { y: s.map(p => p.y).sort((a, b) => a - b)[1], svg }
  })
}

export function draw(w: World): string {
  return drawParts(w).map(p => p.svg).join('')
}

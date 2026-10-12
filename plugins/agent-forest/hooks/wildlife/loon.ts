/**
 * wildlife/loon.ts
 * A common loon swimming lazy loops on the back of the lake, diving once a loop and surfacing somewhere else.
 */

import type { World } from './types'

const PERIOD = 150000
/** How long after the dive ring the surfacing ring starts, in ms. */
const SURFACE_LAG = 12000
/** Where the loop starts and rests, as a fraction of the lake's radii. */
const HOME = { x: 0.25, y: -0.55 }
/** The art is about 20 px from tail to bill tip, so this makes it roughly half a Claude sprite. */
const SIZE = 0.85
/** Where it dives and where it comes up, as offsets from HOME in lake radii. */
const DIVE = { x: -0.2, y: 0.33 }
const RISE = { x: 0.05, y: 0.25 }

// Where it is at each stop, as offsets from HOME in lake radii; the dive is in front of where the moose wades so it never paints over it.
const SPOTS: [string, { x: number; y: number }][] = [
  ['0%,20%,90%,to', { x: 0, y: 0 }],
  ['30%,40%', { x: 0.2, y: -0.07 }],
  ['50%,59%', DIVE],
  ['60%,75%', RISE],
]
// Turns left after the drift, then tips forward and squashes into the waterline, which reads as slipping under.
const POSE = `40%{scale:1}40.3%,52.5%,62%,to{scale:-1 1}54%,60%{scale:-1 0}51%,60%{transform:none}54%,59%{transform:rotate(35deg)}`

export const CSS =
  `.ln{fill:none;stroke-width:.6}.ln-k{fill:#111}.ln-g{fill:#1b3530}.ln-s{stroke:#eee;stroke-dasharray:.5 .7}` +
  `.ln-v,.ln-r{stroke:#eff;opacity:0}.ln-v{animation:ln-o 150s infinite;stroke-dasharray:3 1 2 2 1 3 .5 9}.ln-r{animation:ln-r 150s infinite;rx:12px;ry:3.5px}` +
  `.ln-m{animation:ln-m 150s infinite}.ln-h{transform-origin:4px -3px;animation:ln-h 15s infinite}.ln *{animation-delay:var(--d)}` +
  `@keyframes ln-o{0%,19%,31%,39%,51%,74%,91%,to{opacity:0}22%,28%,42%,48%,77%,88%{opacity:1}}` +
  `@keyframes ln-h{0%,55%,80%,to{rotate:none}62%,72%{rotate:-55deg}}` +
  `@keyframes ln-r{52%{opacity:0;scale:.3}53.5%{opacity:.8}60%{opacity:0;scale:2}}` +
  `@media (prefers-color-scheme:dark){.ln-s{stroke:#aaa}.ln-v,.ln-r{stroke:#8fa9cf}}` +
  `@media (prefers-reduced-motion:reduce){.ln *{animation:none}}`

export const DEFS = ''

/**
 * draw(w)
 * The route is written per render because it stretches with the lake; the art keeps its own shape.
 */
export function draw(w: World): string {
  const { c, rx, ry } = w.lake
  // Small ponds on narrow panes get a smaller loon so it keeps clear of the shore and lily pads.
  const k = SIZE * Math.min(1, Math.max(0.7, rx / 150)) * w.depth(c.y + HOME.y * ry)
  const px = (n: number) => (Math.round(n / k) ? `${Math.round(n / k)}px` : '0')
  const at = (p: { x: number; y: number }) => `translate:${px(p.x * rx)} ${px(p.y * ry)}`
  const d = (lag: number) => `--d:${-Math.round((((w.now - lag) % PERIOD) + PERIOD) % PERIOD / 100) / 10}s`
  const ring = (p: { x: number; y: number }, lag: number) => `<ellipse class="ln-r" style="${lag ? d(lag) + ';' : ''}${at(p)}"/>`
  return (
    `<style>@keyframes ln-m{${SPOTS.map(([s, p]) => `${s}{${at(p)}}`).join('')}${POSE}}</style>` +
    `<g class="ln" style="${d(0)}" transform="translate(${Math.round(c.x + HOME.x * rx)} ${Math.round(c.y + HOME.y * ry)})scale(${String(Math.round(k * 100) / 100).replace(/^0/, '')})">` +
    ring(DIVE, 0) + ring(RISE, SURFACE_LAG) +
    `<g class="ln-m"><path class="ln-v" d="M6 0L-17-2.7M6 0L-17 2.9"/>` +
    `<path class="ln-k" d="M-8.5-.6Q-6-3.8 1-3.6Q4-3.5 5.6-1.5L6 0H-7.5Z"/><path class="ln-s" d="M-6.3-1.7Q-2-3.4 3-2.8M-7-.8Q-2-2.2 3.4-1.6"/>` +
    `<g class="ln-h"><path class="ln-g" d="M2.6-3.2q1.4-.8 2.2-3.4t2.4-1.3 1.4 1.5l3.6.3-3.8.5q-1.1.6-1.2 2t-1.6 2.4z"/><path class="ln-s" d="M4.6-4.4l2.7.3"/></g></g></g>`
  )
}

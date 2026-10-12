/**
 * wildlife/eagle.ts
 * A bald eagle that now and then flies once across the whole sky, flapping a few slow beats between long glides.
 */

import type { World } from './types'

const f = (n: number) => Math.round(n * 10) / 10

// Two passes per PERIOD seconds, one each way; the rest of the time it waits off-screen.
const PERIOD = 300
// A burst of three wingbeats starts every FLAP seconds, so each 25 s crossing gets two or three.
const FLAP = 12
// The gentle rise and fall, with the nose dipping ahead of each descent, takes twice BOB seconds.
const BOB = 5

// Route stops as [second, x, y] in a 1000 x 100 box that draw() stretches over the sky band. Box x 0 and 1000 are
// fully off-screen, and the height only changes out there, so the eagle never pops in.
const ROUTE: [number, number, number][] = [[20, 0, 15], [45, 1000, 30], [170, 1000, 85], [196, 0, 65]]
const pct = (t: number) => `${f((t / PERIOD) * 100)}%`

// Wing poses as up-down scale of a wing drawn straight up, for the near and the far wing. In the glide both are held
// slightly raised, and since we look up from below the far one shows higher, above the near one.
const GLIDE = [0.2, 0.48]
const UP = [0.67, 1]
const DOWN = [-1, -0.43]
const UPS = '4%,13%,22%'
const DOWNS = '8.5%,17.5%,26.5%'
const beat = (name: string, i: number) =>
  `@keyframes ${name}{${UPS}{scale:1 ${UP[i]}}${DOWNS}{scale:1 ${DOWN[i]}}31%{scale:1 ${GLIDE[i]}}}`

// Motion uses the separate translate, rotate and scale properties: Chrome drops a rotate animation on an element
// whose transform is also animated, and these leave the transform attributes free for static placement.
export const CSS =
  `.eg-w{fill:#3b2a1e}.eg-c{fill:#7a5634}.eg-h{fill:#fff}.eg-k{fill:#f0b72f}` +
  `.eg-d{translate:0 ${ROUTE[0][2]}px;animation:eg-x ${PERIOD}s var(--d) linear infinite;animation-name:eg-x,eg-z}` +
  `@keyframes eg-x{${ROUTE.map(([t, x, y]) => `${pct(t)}{translate:${x}px ${y}px}`).join('')}}` +
  // It turns round while it waits off the right edge, and back while it waits off the left.
  `@keyframes eg-z{33%{scale:1}33.1%,85%{scale:-1 1}85.1%{scale:1}}` +
  `.eg-b{animation:eg-b ${BOB}s var(--b) ease-in-out infinite alternate}@keyframes eg-b{from{translate:0 -2.5px;rotate:2deg}to{translate:0 2.5px;rotate:-2deg}}` +
  `.eg-n,.eg-v,.eg-q{animation:eg-n ${FLAP}s var(--f) ease-in-out infinite}.eg-n{scale:1 ${GLIDE[0]}}.eg-v{scale:1 ${GLIDE[1]};filter:brightness(.6);animation-name:eg-v}` +
  beat('eg-n', 0) + beat('eg-v', 1) +
  // The primaries bend about the wrist, swept back at the top of each beat and pressed forward at the bottom.
  `.eg-q{transform-origin:-4px -19px;animation-name:eg-q}@keyframes eg-q{${UPS}{rotate:-12deg}${DOWNS}{rotate:10deg}31%{rotate:none}}` +
  `@media (prefers-color-scheme:dark){.eg-w{fill:#3f2e23}.eg-c{fill:#7a5a3d}.eg-h{fill:#efece4}.eg-k{fill:#e0aa38}}` +
  `@media (prefers-reduced-motion:reduce){[class^=eg]{animation:none}}`

// Drawn flying right with the shoulder at 0 0. The wing is raised straight up, so scaling it flaps it, and its
// covert band is the lighter brown along the leading edge. The body sits below and behind the shoulder.
export const DEFS =
  `<g id="eg-p"><path class="eg-w" d="M5 0c1.2-7-.4-14-3.2-19.6l-11.2 1c-1 5.6-.8 12.6.4 18.6z"/>` +
  `<path class="eg-c" d="M4.8-1.2c1.1-5.8-.3-12.2-2.9-17.2l-2.2.4c2.5 5 3.4 11 2.4 17.2z"/>` +
  `<path class="eg-w eg-q" d="M2.2-18.4c-1.6-3.6-3.2-6.2-4.8-7.2q-5.8-3.8-8 4c.2 1.6.6 2.8 1 3.8zm-2.8-4.8l-3.3-9.3q-1.2-1.4-1.5.5l2.9 9.4zm-1.7.4l-5.1-8.8q-1.6-1.1-1.5.8l4.8 9.1zm-1.8.6l-6.5-7.4q-1.8-.8-1.2 1.1l6.1 7.6zm-1.9.6l-7-5.4q-1.8-.5-1 1.2l6.7 5.7zm-1.7.8l-6.8-3.4q-1.8-.1-.7 1.3l6.6 3.8z"/></g>` +
  `<g id="eg-o"><path class="eg-h" d="M-10.6-3.2l-8.4-1.8q-2.2 3.4-.2 7.4l7.6-1z"/><path class="eg-k" d="M-6 3.4q-3.4 2.2-6.6 1.2 2.6-1.4 5-2.2z"/>` +
  `<path class="eg-w" d="M15-3.6c-6-3.4-19-2.9-26 .4l-1 4.6c8 4.2 18 4.4 24.5 1.2 3.1-1.4 3.7-4.2 2.5-6.2z"/>` +
  `<path class="eg-h" d="M10-5.6c2.2-3.4 8-3.6 10.4-.8l.2 3c-2 2.4-6.2 5.4-9.8 5.6 1.2-3.2.6-5.8-.8-7.8z"/>` +
  `<path class="eg-w" d="M16-6.6l4-.1-.8 1.1q-1 .4-2.1-.1z"/><path class="eg-k" d="M19.8-6.4q3.2-.6 4.4 1.8.2 1.7-1 2.2.1-1.1-.8-1l-2.1.3z"/></g>`

export function draw(w: World): string {
  // About 50 px beak to tail at a 1267 px pane, a little smaller on narrow ones.
  const s = Math.min(1.2, Math.max(0.75, (w.W / 1267) * 1.1))
  const m = 34 * s
  const y0 = 40 * s
  const y1 = Math.max(y0 + 25, w.peaks + (w.horizon - w.peaks) * 0.22)
  const sx = (w.W + 2 * m) / 1000, sy = (y1 - y0) / 100
  const k = (n: number) => `${Math.round(n * 1000) / 1000}`.replace(/^0\./, '.')
  const d = (period: number) => `${f(-(w.now % (period * 1000)) / 1000)}s`
  // The outer group stretches the route over the sky band and the moving group undoes it, so the eagle keeps its shape.
  return (
    `<g transform="translate(${f(-m)} ${f(y0)})scale(${k(sx)} ${k(sy)})" style="--d:${d(PERIOD)};--b:${d(2 * BOB)};--f:${d(FLAP)}">` +
    `<g class="eg-d" transform="scale(${k(s / sx)} ${k(s / sy)})"><g class="eg-b">` +
    `<use class="eg-v" href="#eg-p"/><use href="#eg-o" x="-3" y="4"/><use class="eg-n" href="#eg-p"/></g></g></g>`
  )
}

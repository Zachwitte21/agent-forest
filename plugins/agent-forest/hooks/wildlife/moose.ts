/**
 * wildlife/moose.ts
 * A bull moose that wades out from the back shore of the lake, dunks its head to feed twice, and walks back out.
 */

import type { World } from './types'

const f = (n: number) => Math.round(n * 10) / 10

/** Seconds; 200 keeps every timeline stop at a short percentage (t / 2). */
const PERIOD = 200
/** How far the moose sinks in the shallows, in art units: the belly just clears the water. */
const SINK = 20
/** Head angle while feeding: the muzzle goes under but the antlers stay up. */
const DIP = 55
/** Swinging legs are drawn this far below the waterline clip and lifted into place only while walking. */
const OFF = 300

const pc = (ts: number[]) => ts.map(t => `${Math.round((t / PERIOD) * 1e4) / 100}%`).join(',')
const kf = (name: string, stops: [number[], string][]) => `@keyframes ${name}{${stops.map(([ts, v]) => `${pc(ts)}{${v}}`).join('')}}`

// Timeline in seconds: walk in 30 to 40, feed 46 to 63 and 74 to 93, turn at 110, walk out 112 to 122, turn back at 170.
// The route is drawn in a frame where the shore spot is 0,0 and the wading spot is 1,1, so these never change with the pane.
const KEYFRAMES =
  kf('ms-v', [[[30, 122], 'translate:none'], [[40, 112], 'translate:1px 1px'], [[110, 170.2], 'scale:1'], [[110.2, 170], 'scale:-1 1']]) +
  kf('ms-g', [[[30, 40, 112, 122], 'translate:none'], [[30.2, 39.8, 112.2, 121.8], `translate:0 -${OFF}px`]]) +
  kf('ms-s', [[[33, 119], 'translate:none'], [[40, 112], `translate:0 ${SINK}px`]]) +
  kf('ms-h', [
    [[10, 22, 46, 63, 74, 93, 138, 150], 'rotate:none'],
    [[12, 20, 140, 148], 'rotate:-12deg'],
    [[49, 60, 77, 90], `rotate:${DIP}deg`],
  ]) +
  kf('ms-r', [[[60.8, 66, 90.8, 96], 'scale:1.6;opacity:0'], [[61, 91], 'scale:.3;opacity:.8']]) +
  kf('ms-o', [[[34, 118], 'opacity:0'], [[38, 113], 'opacity:1']])

export const CSS =
  `.ms-d{fill:#432}.ms-t{fill:#643}.ms-a{fill:#cb9}.ms-b{fill:#986}.ms-l,.ms-f{fill:none;stroke:#987;stroke-width:3.9;stroke-linecap:round}.ms-f{stroke:#765;stroke-width:3.5}.ms-sh{opacity:.15}.ms-w{fill:none;stroke:#eff;stroke-width:1.2}` +
  `.ms-m{--a:${PERIOD}s var(--d) infinite both;animation:ms-v var(--a)}.ms-g{animation:ms-g var(--a)}.ms-k{animation:ms-s var(--a)}.ms-h{animation:ms-h var(--a)}` +
  `.ms-r,.ms-o{opacity:0;transform-box:fill-box;transform-origin:center;animation:ms-r var(--a)}.ms-o{animation-name:ms-o}` +
  `.ms-p{transform-box:fill-box;transform-origin:50% 0;animation:ms-p .7s infinite alternate}.ms-z{animation-delay:-.7s}@keyframes ms-p{from{rotate:-10deg}to{rotate:10deg}}` +
  KEYFRAMES +
  `@media (prefers-color-scheme: dark){.ms-d{fill:#321}.ms-t{fill:#432}.ms-a{fill:#876}.ms-b{fill:#654}.ms-l{stroke:#554}.ms-f{stroke:#443}.ms-sh{opacity:.35}.ms-w{stroke:#8ac}}` +
  // A zero-length run leaves every part in its base pose: on the shore, head up, still legs.
  `@media (prefers-reduced-motion: reduce){.ms-m{--a:0s}}`

const HIND = (y: number) => `M-19 ${y - 28}l-2 17 2 11`
const FORE = (y: number) => `M12 ${y - 26}v14l1 12`

// Facing right with hooves on y = 0; once the body sinks, the clip's bottom edge is the waterline.
export const DEFS =
  `<clipPath id="ms-c"><rect x="-80" y="-90" width="160" height="93"/></clipPath>` +
  `<path id="ms-a" d="M8-1C2-4-5-6-10-9q-3-3-1-9${'q1.8-3.5 3.6.8'.repeat(9)}q3-1 3 2Q19-3 8-1z"/>`

// Only the near pair swings, hind against fore; the shaded far pair stays put to save characters.
// Each antler is one broad palm with a row of short blunt points; the far one peeks out behind the head.
const ART =
  `<path class="ms-f" d="M16-26v14l1 12M-14-27l-2 16 2 11"/>` +
  `<path class="ms-d" d="M-26-32Q-26-39-18-40Q-6-41 2-48Q8-53 14-48Q19-44 21-36Q22-24 14-22Q0-22-10-25Q-20-24-24-27Q-27-29-26-32z"/>` +
  `<path class="ms-t" d="M-23-38Q-8-40 2-47Q8-51 13-48Q6-47 0-43Q-10-38-23-36z"/>` +
  `<g class="ms-g"><path class="ms-l" d="${HIND(0)}${FORE(0)}"/><path class="ms-l ms-p" d="${HIND(OFF)}"/><path class="ms-l ms-p ms-z" d="${FORE(OFF)}"/></g>` +
  `<g transform="translate(16 -44)"><g class="ms-h"><use href="#ms-a" class="ms-b" x="-4" y="-3"/>` +
  `<path class="ms-d" d="M-6-8Q3-6 9 0L22 8Q28 11 27 15Q26 18 22 17L13 13Q13 20 11 23Q11 16 9 14L3 17L-8 6zM8 0L1-4L5 2z"/>` +
  `<circle cx="16" cy="4" r=".9"/><use href="#ms-a" class="ms-a"/><path class="ms-b" d="M8-1C2-4-5-6-10-9q9 4 18 6z"/></g></g>`

/**
 * draw(w)
 * One bull moose on the back left shore, wading a short way into the back half of the lake.
 */
export function draw(w: World): string {
  const { c, rx, ry } = w.lake
  // Smaller ponds on narrow panes get a smaller moose so it never fills the lake.
  const k = Math.min(1, Math.max(0.7, rx / 160)) * 0.9
  const dx = f(rx * 0.24), dy = f(ry * 0.53)
  const s = k * w.depth(c.y - ry * 0.77)
  const d = f(-(w.now % (PERIOD * 1000)) / 1000)
  return (
    `<g transform="translate(${f(c.x - rx * 0.48)} ${f(c.y - ry * 1.03)})scale(${dx} ${dy})"><g class="ms-m" style="--d:${d}s">` +
    `<g transform="scale(${+(s / dx).toPrecision(3)} ${+(s / dy).toPrecision(3)})"><g clip-path="url(#ms-c)"><g class="ms-k"><ellipse class="ms-sh" cy="1" rx="26" ry="3"/>${ART}</g></g>` +
    `<ellipse class="ms-w ms-o" cy="-.5" rx="28" ry="4.5"/><ellipse class="ms-w ms-r" cx="20" rx="9" ry="2.5"/></g></g></g>`
  )
}

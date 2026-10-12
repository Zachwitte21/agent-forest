/**
 * wildlife/grizzly.ts
 * One grizzly ambling between three spots in the meadow: it digs, sits back to sniff the air, and moves on.
 */

import type { World } from './types'

// Every short cycle (1 s strides, .75 s dirt, 5 s sniffs) divides this, so one shared delay keeps them all in step.
const LOOP_S = 150

// The timeline steps three flags (--s sitting, --d digging, --f facing) and every pose detail is derived from them.
// Sitting swaps the standing bear for its own drawing, which borrows the standing head.
export const CSS =
  '.gz-b{fill:#753}.gz-d{fill:#532}.gz-x{fill:#321}.gz-g{fill:#a86}.gz-c{stroke:#eed;stroke-width:.6}.gz-s{opacity:.15}' +
  `.gz-m{--s:1;--d:0;--f:1;animation:gz-p ${LOOP_S}s linear infinite,gz-k ${LOOP_S}s step-end infinite}` +
  '.gz-f{scale:var(--f) 1}.gz-W{opacity:calc(1 - var(--s))}.gz-S{opacity:var(--s)}' +
  '.gz-j,.gz-e,.gz-h{transform-box:fill-box;transform-origin:50% 0}.gz-j,.gz-e{rotate:calc(var(--a)*-14deg);animation:gz-l 1s infinite alternate}.gz-v{--h:1s}' +
  '.gz-j{--a:calc(1 - var(--d))}.gz-e{--a:1}' +
  '.gz-h{transform-origin:22% 60%;rotate:calc(var(--d)*60deg - var(--s)*8deg);animation:gz-n 5s infinite}' +
  '.gz-q{fill-opacity:var(--d);animation:gz-q .75s infinite}[class*=gz-]{animation-delay:calc(var(--gz) + var(--h,0s))!important}' +
  '@keyframes gz-l{to{rotate:calc(var(--a)*14deg)}}' +
  '@keyframes gz-n{70%,80%{rotate:calc(var(--d)*50deg - var(--s)*30deg)}}@keyframes gz-q{to{translate:-9px -6px;opacity:0}}' +
  '@media (prefers-color-scheme:dark){.gz-b{fill:#543}.gz-d{fill:#432}.gz-x{fill:#211}.gz-g{fill:#765}.gz-s{opacity:.35}}' +
  '@media (prefers-reduced-motion:reduce){[class*=gz-]{animation:none!important}}'

// Faces right with feet on y = 0; one clawed leg serves all four, and the head pivots at the neck.
export const DEFS =
  '<g id="gz-L"><path d="M-3-10q3-3 6 0v9q0 1-1 1h-5q-1 0-.6-1z"/><path class="gz-c" d="M2.6 0h2.2m-2.4-1l2.2.3"/></g>' +
  '<g id="gz-W"><use href="#gz-L" x="-11" class="gz-x gz-j"/><use href="#gz-L" x="7" class="gz-x gz-e gz-v"/>' +
  '<path class="gz-b" d="M-19-10C-22-14-20-21-14-22S-5-23-2-26S7-28 10-24L15-19L14-11C8-6-13-5-19-10Z"/>' +
  '<path class="gz-g" d="M-12-22C-7-23-5-23-2-26S7-28 10-24C6-25 3-25 0-23S-8-21-12-22Z"/>' +
  // Dished face; the back of the skull is a circle round the pivot, so dipping or lifting never pokes it out of the shoulders.
  '<g id="gz-H" class="gz-h gz-b"><path d="M12.5-24c2.5-1.8 5.5-2.2 7.3-.9c1.1.9 1.2 2.5 2.4 3q2.3.4 4.6.2q1.5.4 1.1 2.4q-.4 1-1.9 1.1l-2.6.8q-1.9 1.8-4.9 2.4q-3.5.4-6 0a4.5 4.5 0 0 1 0-9z"/>' +
  '<path class="gz-g" d="M22.6-21.7h4.3v2.5l-3.5 1.8q-1.4-2-.8-4.3z"/>' +
  '<path class="gz-d" d="M13.4-24.6q.4-2.2 2.4-1.8q.9.5.1 2zm-.1.8q2.4 4 .4 8.3q.7-4.3-.4-8.3z"/>' +
  '<path class="gz-x" d="M26.9-21.6q1.4.2 1.1 2.1q-.4.6-1.1.4q-.7-1 0-2.5zm-5.8-.8a.6.6 0 1 0 .1 0z"/></g>' +
  '<use href="#gz-L" x="-14" class="gz-d gz-j gz-v"/><use href="#gz-L" x="10" class="gz-d gz-e"/>' +
  '<path class="gz-g gz-q" d="M14-1h1v1h-1zm2-2h1v1h-1zm-4 1h1v1h-1z"/></g>' +
  // Sitting: rump on the grass, back up and hunched, hind foot out in front, foreleg straight down.
  '<g id="gz-S"><path class="gz-b" d="M-15 0C-20-2-19-11-15-15S-10-27-6-30S4-33 5-29L7-21C9-13 8-5 6 0Z"/>' +
  '<path class="gz-g" d="M-15-15S-10-27-6-30S4-33 5-29C1-31-12-20-15-15Z"/>' +
  '<path class="gz-d" d="M-14 0C-16-9-8-12-3-10S3-5 2-3h9q2 0 2 3z"/><path class="gz-x" d="M3-21q2.5-3 5 0l.4 20q0 1-1 1h-4.4z"/>' +
  '<path class="gz-c" d="M8.4 0h2m-2-1h2"/><use href="#gz-H" x="-11" y="-12"/><path class="gz-b" d="M-6-29.6c1.5-3.9 4.5-6 8-6.4l2 6z"/></g>'

const SEED = 41
const RIGHT_OF = 0.5
// The right-hand marmot burrow, as fractions of the meadow (see marmot.ts), which the bear gives a wide berth.
const BURROW = [0.86, 0.5]
const BERTH = 70
const SPEED = 9
// How the time left after walking is shared: sit at A, dig at B, sit at B, dig at C.
const PAUSES = [3, 2, 1.6, 2.4]

const r1 = (n: number) => Math.round(n * 10) / 10

type Spot = { x: number; y: number; s: number }

/** Three resting spots, with every spacing rule eased by k so a cramped pane still gets its bear. */
function spots(w: World, k: number): Spot[] | null {
  let seed = SEED
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  // Right of centre in the open meadow, and clear of the strip by the trees, which the black bear walks.
  const x0 = w.W * RIGHT_OF * k, x1 = w.meadow.x1 - 40
  const y1 = w.meadow.y1 - 16, y0 = y1 - (y1 - w.meadow.y0) * 0.55
  if (x1 - x0 < 120 * k || y1 <= y0) return null
  const bx = w.meadow.x0 + (w.meadow.x1 - w.meadow.x0) * BURROW[0], by = w.meadow.y0 + (w.meadow.y1 - w.meadow.y0) * BURROW[1]
  for (let i = 0; i < 400; i++) {
    const p = [0, 1, 2].map(() => {
      const y = Math.round(y0 + rnd() * (y1 - y0))
      return { x: Math.round(x0 + rnd() * (x1 - x0)), y, s: w.depth(y) }
    })
    const ok = p.every((a, j) => {
      const b = p[(j + 1) % 3], d = Math.hypot(a.x - b.x, a.y - b.y)
      return w.isClear(a.x, a.y, 22 * a.s) && Math.hypot(a.x - bx, a.y - by) > BERTH * k && d > 70 * k && d < 220
    })
    if (ok) return p
  }
  return null
}

export function draw(w: World): string {
  const p = spots(w, 1) ?? spots(w, 0.7) ?? spots(w, 0.4)
  if (!p) return ''
  // Starting at the rightmost spot means the bear always arrives home facing right, the default.
  const [A, B, C] = [...p].sort((a, b) => b.x - a.x)
  const walk = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y) / (SPEED * (a.s + b.s) / 2)
  const face = (a: Spot, b: Spot) => (b.x >= a.x ? 1 : -1)
  const share = (LOOP_S - walk(A, B) - walk(B, C) - walk(C, A)) / PAUSES.reduce((a, b) => a + b)
  const [sitA, digB, sitB, digC] = PAUSES.map(n => n * share)
  const tA = sitA, tB = tA + walk(A, B), tB2 = tB + digB, tBl = tB2 + sitB
  const tC = tBl + walk(B, C), tCl = tC + digC
  const pc = (t: number) => `${r1((t / LOOP_S) * 100)}%`
  const at = (q: Spot) => `translate:${q.x}px ${q.y}px;scale:${`${Math.round(q.s * 100) / 100}`.replace(/^0\./, '.')}`
  // 0% and 100% fall back to the inline spot A, which is also where reduced motion leaves the bear.
  const move = `${pc(tA)}{${at(A)}}${pc(tB)},${pc(tBl)}{${at(B)}}${pc(tC)},${pc(tCl)}{${at(C)}}`
  // Each flag is written only where it changes; a stepped track holds a value until the next one that names it.
  const last: Record<string, number> = { s: 1, d: 0, f: 1 }
  const step = ([t, s, d, f]: number[]) => {
    const set = Object.entries({ s, d, f }).filter(([k, v]) => last[k] !== v).map(([k, v]) => `--${k}:${(last[k] = v)}`)
    return set.length ? `${pc(t)}{${set.join(';')}}` : ''
  }
  const steps = [
    [0, 1, 0, face(C, A)],
    [tA, 0, 0, face(A, B)],
    [tB, 0, 1, face(A, B)],
    [tB2, 1, 0, face(A, B)],
    [tBl, 0, 0, face(B, C)],
    [tC, 0, 1, face(B, C)],
    [tCl, 0, 0, face(C, A)],
  ]
  return (
    `<g class="gz-m" style="--gz:${r1(-(w.now % (LOOP_S * 1000)) / 1000)}s;${at(A)}">` +
    `<style>@keyframes gz-p{${move}}@keyframes gz-k{${steps.map(step).join('')}}</style>` +
    `<ellipse class="gz-s" rx="20" ry="3"/><g class="gz-f"><use href="#gz-S" class="gz-S"/><use href="#gz-W" class="gz-W"/></g></g>`
  )
}

/**
 * wildlife/marmot.ts
 * Two hoary marmots, each popping out of its own burrow in the meadow to stand sentry, nibble and dive back in.
 */

import type { World } from './types'

// One loop length; each burrow starts at its own point in it, so the two never pop up in step.
const PERIOD = 170000
// Where each burrow sits, as fractions of the meadow box, which way its marmot faces and how far into the loop it runs.
const SPOTS: [number, number, number, number][] = [[0.12, 0.35, 1, 0], [0.86, 0.62, -1, 0.55]]
// Art is drawn at depth-1 Claude scale; this sets the marmot a little larger than life so it reads at a glance.
const SIZE = 1.4
// Clearance around a burrow in local units, wide enough for the mound and the marmot nibbling beside it.
const REACH = 16

export const CSS =
  `.mm-a{--o:1;translate:12px 1px;animation:mm-a ${PERIOD / 1000}s var(--d) linear infinite}` +
  // Flips at almost the same stop are the look-arounds and the about-face before it dashes home.
  // --o swaps sitting for all fours: custom properties step at the midpoint between stops, so 7% and 21% switch it at 14%.
  '@keyframes mm-a{34%,43%,80%,90.1%{scale:1}34.1%,42.6%,80.1%,90%{scale:-1 1}7%,39%,43%,91%,99%{--o:1}21%,41%,95%{--o:0}' +
  '14%,96%{translate:12px 1px}30%,40%{translate:15px 1px}42%,87%,93%{translate:0}42.6%,75%{translate:0 14px}77%,85%{translate:0 7.5px}}' +
  '@media (prefers-color-scheme:dark){.mm-z{filter:brightness(.6)}}@media (prefers-reduced-motion:reduce){.mm-a{animation:none}}'

export const DEFS =
  // Round head with a small ear, dark crown and eye band, a white band before the eyes and a white muzzle.
  '<g id="mm-h"><ellipse rx="2.8" ry="2.3" fill="#ddd"/><path fill="#fff" d="M2-1.3l.9.3-.1 1.2-1-.2zM1.2.4q2-.8 2.8.2q-.2 1.2-2.4 1z"/>' +
  '<path fill="#211" d="M-2.3-1.5a1 1 0 0 1 1.8-.9zM-1.6-1.5q1.8-1.4 3.6-.5l.8 1.6-1 .2q-.6-.6-1.2-.1q-1-.7-2.2-1.2zM3.4-.1h.6v.6h-.6z"/></g>' +
  // The clip cuts out the hole's front half and widens below it, so a ducking marmot sinks into the ground instead of fading;
  // the inner part runs the other way round, which makes it a hole without clip-rule.
  '<clipPath id="mm-c"><path d="M-20-20h40v40h-40zM-4.5-2.5l-14 20h37l-14-20a4.5 2 0 0 1-9 0z"/></clipPath>' +
  '<g id="mm-z" class="mm-z"><ellipse rx="15" ry="2.6" fill="#0002"/><path fill="#dc9" d="M-13 0q4-7 13-7t13 7z"/>' +
  '<ellipse fill="#221" cy="-2.5" rx="4.5" ry="2"/><ellipse fill="#998" cx="-10" cy="-.5" rx="2" ry="1.4"/><g clip-path="url(#mm-c)"><g class="mm-a">' +
  // Sitting up, facing right: a fat pear with silver chest and shoulders grading to a browner rump.
  '<g style="opacity:var(--o)"><path fill="#753" d="M-4-.3q-3.4.3-3.3-2.6q1.8 1 3.3.6z"/><path fill="#ccc" d="M-4 0c-2-2-1.6-6 1-7.5c1.5-.8 3-.7 4 .3c1.6 1.6 2.6 4.6 2 7.2z"/>' +
  '<path fill="#987" d="M-4 0c-2-2-1.6-6 1-7.5q-1.4 4 1 7.5z"/><path fill="#eee" d="M1-6.6q2 1.6 1.8 4z"/><path fill="#211" d="M0-.8h3.4v.8h-3.4z"/><use href="#mm-h" x=".4" y="-9.3"/></g>' +
  // On all fours with the back arched, head down in the grass, short dark legs and the tail trailing.
  '<g style="opacity:calc(1 - var(--o))"><path fill="#753" d="M-5.6-2.6q-3-.6-4.6 1.6q2 .6 4.6-.2z"/><path fill="#ccc" d="M-6-2c-1-2.6 1-4.6 4.5-4.6c3 0 5.5 1.4 6.5 3.4l-.5 2c-3.5 1-7 1-10.5-.8z"/>' +
  '<path fill="#987" d="M-6-2c-1-2.6 1-4.6 4.5-4.6q-4 1.4-2.5 5.4z"/><path fill="#211" d="M-4.8-2h1.8v2h-1.8zM2.6-2h1.6v2h-1.6z"/><use href="#mm-h" x="4" y="-5.1" transform="rotate(30)"/></g></g></g></g>'

const r = (n: number) => String(Math.round(n * 100) / 100).replace(/^(-?)0\./, '$1.')

export function draw(w: World): string {
  const m = w.meadow
  return SPOTS.map(([fx, fy, face, phase]) => {
    // Scan inward from the preferred spot so the burrow lands on open grass whatever the pane size.
    let x = 0, y = 0, s = 1
    for (let k = 0; k < 40; k++) {
      x = m.x0 + (m.x1 - m.x0) * (fx + face * k * 0.01)
      y = m.y0 + (m.y1 - m.y0) * (fy + (k % 5) * 0.06 - 0.12)
      s = w.depth(y) * SIZE
      if (w.isClear(x, y, REACH * s)) break
    }
    return `<use href="#mm-z" transform="translate(${Math.round(x)} ${Math.round(y)})scale(${face < 0 ? `-${r(s)} ` : ''}${r(s)})" style="--d:${r(-((w.now + phase * PERIOD) % PERIOD) / 1000)}s"/>`
  }).join('')
}

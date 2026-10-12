/**
 * wildlife/blackbear.ts
 * One black bear ambling along the forest edge, rising on its hind legs to sniff the air and nosing at the ground.
 */

import type { World } from './types'

const PERIOD = 180
const STRIDE = 1.1
const HALF = 19
const SEED = 23
// A starts in the left part of the strip, which keeps the loop off the elk herd grazing on the right.
const START = 0.35
// Seconds of each walk (A to B, B to C, C back to A); the route is picked so these give 7 to 15 px/s at depth 1.
const WALKS = [18, 18, 34]

// One fixed timeline (as % of PERIOD) drives every pose, so only the route's coordinates depend on the pane.
// The legs swing all the time, scaled by --q, which the timeline flips to 1 only while walking.
export const CSS: string =
  '.bb-m{fill:#222;animation:bb-m var(--z),bb-q var(--z)}.bb-k{fill:#111}.bb-g{fill:#556}.bb-u{stop-color:#b5835a}.bb-n{fill:#4a3020}.bb-o{opacity:.17}' +
  '.bb-r,.bb-f{animation:bb-r var(--z)}.bb-r{--a:-68deg;transform-origin:-11px -11px}.bb-f{--a:55deg}.bb-h{transform-origin:6px -16px;animation:bb-h var(--z)}' +
  '.bb-a,.bb-b,.bb-f{transform-box:fill-box;transform-origin:50% 0}.bb-a,.bb-b{animation:bb-a .55s var(--e) infinite alternate}.bb-b{animation-direction:alternate-reverse}' +
  '@keyframes bb-a{from{rotate:calc(var(--q)*-13deg)}to{rotate:calc(var(--q)*13deg)}}' +
  '@keyframes bb-q{15.5%,25.6%,47.7%,57.8%,81%{--q:0}15.6%,25.5%,47.8%,57.7%,81.1%,99.9%{--q:1}}' +
  '@keyframes bb-r{27.2%,34.4%{rotate:0deg}28%,33.6%{rotate:var(--a)}}' +
  '@keyframes bb-h{1.7%,11.1%,27.2%,35%,36.7%,44.4%,58.9%,70.8%{rotate:0deg}2.5%,10.3%,37.5%,43.6%,59.7%,70%{rotate:42deg}28%,33.6%{rotate:10deg}}' +
  '@media (prefers-color-scheme:dark){.bb-m{fill:#29292e}.bb-g{fill:#4a4a55}.bb-u{stop-color:#7a5a3e}.bb-n{fill:#3a2a20}.bb-o{opacity:.4}}' +
  '@media (prefers-reduced-motion:reduce){.bb-m,.bb-m *{animation:none}}';

export const DEFS: string =
  '<path id="bb-H" d="M-17.5-13q-1 6 1.5 11q0 2 2 2h5q1 0 .3-1.6l-2-.8.4-9z"/>' +
  '<path id="bb-F" d="M3.5-11l.5 9.4q0 1.6 1.8 1.6h4q1 0 .3-1.4l-1.6-.8.4-8.8z"/>' +
  '<linearGradient id="bb-u"><stop offset=".1" class="bb-u" stop-opacity="0"/><stop offset=".6" class="bb-u"/></linearGradient>';

// Hips higher than the shoulders, no hump; a round skull with a straight profile, rounded ears and a long muzzle fading to tan.
const BODY = '<path d="M-18-9c-2.5-5 2-12.4 7-12.4q8 .4 17 3q4 .6 6 3.4q1.5 4-2 6.5q-10 2.1-19 .5q-6 .6-9-1z"/><path class="bb-g" d="M-16-19q7-2.6 19 .2q-11-.8-19-.2z"/>';
const HEAD =
  '<path class="bb-k" d="M9.6-19.6l.6-1.8q.6-.9 1.4-.2l1 2z"/>' +
  '<path d="M4-17.5q4-2.3 6.6-2.4q1.8-.7 3.6.1l6.2 2.7q1.3.6 1 1.9q-.8.8-3 .9q-2.6.1-4.8 1.7q-2.6 1-5 2.2l-2.6.8-2-2.4zM11-19.8l.6-1.8q.6-.9 1.4-.2l1 2z"/>' +
  '<path fill="url(#bb-u)" d="M14.2-19.8l6.2 2.7q1.3.6 1 1.9q-.8.8-3 .9q-2.6.1-4.8 1.7z"/>' +
  '<path class="bb-g" d="M10.4-19.7q2-1 4-.1q-2-.4-4 .1z"/><circle class="bb-n" cx="15.6" cy="-18.1" r=".85"/><circle class="bb-k" cx="15.7" cy="-18.1" r=".45"/>' +
  '<ellipse class="bb-k" cx="21" cy="-16.1" rx=".8" ry=".7"/>';

const n = (v: number, k = 10) => String(Math.round(v * k) / k).replace(/^(-?)0\./, '$1.');

function rng(seed: number) {
  let a = seed;
  return () => (a = (Math.imul(a, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
}

type Spot = { x: number; y: number };

/** route(w) Seeded search for three clear resting spots, left to right, spaced so each walk keeps a believable pace. */
function route(w: World): Spot[] {
  const b = w.forestEdge, rand = rng(SEED), mx = 40;
  // Probing in front too keeps it off the patch just behind a trunk, where it would paint over the tree.
  const clear = (p: Spot) =>
    p.x > b.x0 + mx && p.x < b.x1 - mx && p.y > b.y0 + 4 && p.y < b.y1 - 2 && [-12, 0, 16, 32].every(dy => w.isClear(p.x, p.y + dy, HALF * w.depth(p.y)));
  const pace = (p: Spot, q: Spot, s: number) => Math.hypot(q.x - p.x, q.y - p.y) / s / w.depth((p.y + q.y) / 2);
  const yAt = () => b.y0 + 4 + rand() * (b.y1 - b.y0 - 6);
  let best: Spot[] = [];
  for (let i = 0, top = -1; i < 400; i++) {
    const a = { x: b.x0 + mx + rand() * (b.x1 - b.x0) * START, y: yAt() };
    const m = { x: a.x + (8 + rand() * 6) * WALKS[0] * w.depth(a.y), y: yAt() };
    const c = { x: m.x + (8 + rand() * 6) * WALKS[1] * w.depth(m.y), y: yAt() };
    const paces = [pace(a, m, WALKS[0]), pace(m, c, WALKS[1]), pace(c, a, WALKS[2])];
    const score = [a, m, c].filter(clear).length + paces.filter(v => v > 7 && v < 15).length;
    if (score > top) (top = score), (best = [a, m, c]);
    if (score === 6) break;
  }
  return best;
}

export function draw(w: World): string {
  const [a, b, c] = route(w);
  const at = (p: Spot, dir: number) => {
    const s = n(w.depth(p.y), 100);
    return `translate:${n(p.x, 1)}px ${n(p.y, 1)}px;scale:${dir < 0 ? `-${s} ` : ''}${s}`;
  };
  // Rests at A facing left after the long walk back, turns at 28 s and heads right.
  const key = `@keyframes bb-m{15.56%{${at(a, -1)}}15.57%{${at(a, 1)}}25.56%,47.78%{${at(b, 1)}}57.78%,81.11%{${at(c, 1)}}81.12%{${at(c, -1)}}}`;
  const d = n(-(w.now % (PERIOD * 1000)) / 1000);
  const e = n(-(w.now % (STRIDE * 1000)) / 1000, 100);
  return (
    `<style>${key}</style>` +
    // The inline pose is the rest at A; the animation overrides it, and reduced motion falls back to it.
    `<g class="bb-m" style="${at(a, -1)};--z:${PERIOD}s ${d}s infinite;--e:${e}s">` +
    `<ellipse class="bb-o" rx="19" ry="2.6"/><use class="bb-k bb-a" href="#bb-H" x="3"/><use class="bb-b" href="#bb-H"/>` +
    `<g class="bb-r"><g class="bb-f"><use class="bb-k bb-b" href="#bb-F" x="-2"/><use class="bb-a" href="#bb-F"/></g>` +
    `${BODY}<g class="bb-h">${HEAD}</g></g></g>`
  );
}

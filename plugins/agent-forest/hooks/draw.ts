import type { FNode, Forest, Pin, Touch } from '../types'
import * as clearing from './camp/clearing'
import * as fireArt from './camp/fire'
import * as lake_ from './camp/lake'
import * as log from './camp/log'
import * as mountains from './camp/mountains'
import * as radio from './camp/radio'
import * as stump from './camp/stump'
import { drawTree, TREE_CSS, TREE_DEFS } from './trees'
import * as backdrop from './backdrop'
import * as wildlife from './wildlife/index'
import type { TreeArt } from './trees'

const CAMP_CSS = [clearing, fireArt, lake_, log, mountains, radio, stump].map(m => m.CSS).join('')
const CAMP_DEFS = [clearing, fireArt, lake_, log, mountains, radio, stump].map(m => m.DEFS).join('')

type P = { x: number; y: number }
type Opts = { titles: boolean; maxFiles: number; maxDepth: number; maxTufts: number; wildlife?: boolean }

// A walk, not a hop: slow enough to follow an agent across the picture.
export const MOVE_MS = 4000
// Finished agents keep their card this long, so their summary can be read.
export const DONE_KEEP_MS = 90000
const READ_GLOW_MS = 4000
const PAD = 8
// The Svg element refuses a source past 131,072 characters.
const SVG_BUDGET = 128000
const FONT = 'ui-sans-serif,system-ui,-apple-system,sans-serif'

const r1 = (n: number) => Math.round(n * 10) / 10
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n: number) => (s.length > n ? '…' + s.slice(-(n - 1)) : s)
const clipEnd = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

// The bubble's two lines: what the agent is doing, then the file, query or memory it's doing it to.
const BUBBLE_VERB: Partial<Record<Pin['doing'], string>> = { read: 'Reading', write: 'Editing', search: 'Searching', web: 'Searching the web' }
const BUBBLE_CHARS = 26
// The monospace font's advance at 10px, for sizing the bubble to its text.
const BUBBLE_CHAR_PX = 6.1

/** The bubble's text and size, or null when the agent has nothing worth saying. */
function bubbleText(pin: Pin): { head: string; body: string; w: number } | null {
  let head = BUBBLE_VERB[pin.doing]
  let body = pin.detail
  if (pin.doing === 'memory') {
    const [verb, ...rest] = pin.detail.split(' ')
    head = verb === 'saving' ? 'Saving memory' : 'Recalling memory'
    body = rest.join(' ')
  }
  if (!head || !body) return null
  // A path shows as its file name, keeping any "+2" for the other files in the same command.
  if (pin.doing === 'read' || pin.doing === 'write') body = body.replace(/^.*\//, '')
  body = clipEnd(body, BUBBLE_CHARS)
  return { head, body, w: Math.max(head.length, body.length) * BUBBLE_CHAR_PX + 12 }
}

const BUBBLE_H = 30
// The bubble's left edge and its tail, in px from the agent's feet.
const BUBBLE_L = -10
const BUBBLE_TAIL = -4

/** How far above the agent's head the bubble sits: just over it, or lifted clear of bubbles already placed. */
function bubbleLift(x: number, top: number, w: number, placed: Array<{ x0: number; x1: number; y0: number; y1: number }>): number {
  let lift = 0
  const boxAt = (l: number) => ({ x0: x + BUBBLE_L, x1: x + BUBBLE_L + w, y0: top - l - BUBBLE_H, y1: top - l + 8 })
  for (let tries = 0; tries < 12; tries++) {
    const box = boxAt(lift)
    const hit = placed.find(b => box.x0 < b.x1 && b.x0 < box.x1 && box.y0 < b.y1 && b.y0 < box.y1)
    if (!hit) break
    // Rise until this bubble's tail clears the top of the one in the way; never settle back onto a bubble already passed.
    lift = Math.max(lift + 1, top + 10 - hit.y0)
  }
  placed.push(boxAt(lift))
  return lift
}

/**
 * An old-school speech bubble over a busy agent, kept the same size at any depth by undoing the sprite's scale.
 * A lifted bubble keeps its tail on the agent's head.
 */
function bubble(t: { head: string; body: string; w: number }, s: number, lift: number, dx: number): string {
  const L = BUBBLE_L + dx, R = r1(L + t.w), head = -(24 * s + 4), B = r1(head - 8 - lift), T = r1(B - BUBBLE_H), r = 5, tx = BUBBLE_TAIL
  const d = `M${L + r} ${T}H${r1(R - r)}Q${R} ${T} ${R} ${r1(T + r)}V${r1(B - r)}Q${R} ${B} ${r1(R - r)} ${B}H${tx + 9}L${tx + 1} ${r1(head)}L${tx + 3} ${B}H${L + r}Q${L} ${B} ${L} ${r1(B - r)}V${r1(T + r)}Q${L} ${T} ${L + r} ${T}Z`
  return `<g transform="scale(${Math.round(100 / s) / 100})"><path class="sb" d="${d}"/><text class="sbt" x="${L + 6}" y="${r1(T + 12.5)}"><tspan font-weight="700">${xml(t.head)}</tspan><tspan x="${L + 6}" dy="12">${xml(t.body)}</tspan></text></g>`
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Seeded by name, so a tree grows the same shape every time it is drawn. */
export function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), h | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}







type Ctx = { o: Opts; touches: Record<string, Touch>; now: number }



export const VERB: Record<Pin['doing'], string> = { read: 'reading', write: 'editing', search: 'searching', web: 'searching the web for', memory: '', work: 'working', idle: 'idle' }

/** The tree a path grows on: its top folder when that folder is a tree, else the root's own files. */
export function treeKey(f: Forest | null, rel: string): string {
  const seg = rel.split('/')[0]
  return f && seg && f.trees.some(t => t.path === seg) ? seg : ''
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** One grass tuft of three blades from a single root, written with relative moves to keep it short. */
function tuftPath(x: number, y: number, s: number, h: number): string {
  const a = [r1(-2 * s), r1(-h * 0.7)], b = [r1(0.4 * s), r1(-h)], c = [r1(2.2 * s), r1(-h * 0.6)]
  // Out to each blade tip and back to the root in one run of relative lines: the same strokes, fewer letters.
  return `M${Math.round(x)} ${Math.round(y)}l${[a[0], a[1], -a[0], -a[1], b[0], b[1], -b[0], -b[1], c[0], c[1]].map(n => r1(n)).join(' ')}`.replace(/ -/g, '-').replace(/(^|[ -])0\./g, '$1.')
}

/** Tufts scattered over the ground, smaller toward the horizon. */
function grass(W: number, horizon: number, H: number): string {
  const rnd = seeded('grass')
  let d = ''
  // Sparser than it once was: the animals bring the meadow to life, and the picture's size budget is tight.
  for (let i = 0; i < W / 7; i++) {
    const y = lerp(horizon + 4, H - 3, Math.pow(rnd(), 0.75))
    const s = lerp(0.35, 1.1, (y - horizon) / (H - horizon))
    const x = rnd() * W
    const h = (3 + rnd() * 4) * s
    d += tuftPath(x, y, s, h)
  }
  return `<path class="gr" d="${d}"/>`
}

/**
 * The camp's own grass: the same tufts, flowers and rocks as the meadow, at foreground size, so the ground doesn't go flat
 * below the forest. The clearing and the lake are drawn over it; flowers and rocks keep out of both.
 */
function campGround(W: number, top: number, H: number, camp: Camp): string {
  const rnd = seeded('campground')
  const inside = (x: number, y: number, c: P, rx: number, ry: number) => ((x - c.x) / rx) ** 2 + ((y - c.y) / ry) ** 2 < 1
  let d = ''
  for (let i = 0; i < W / 6; i++) {
    const y = lerp(top + 2, H - 2, rnd())
    const x = rnd() * W
    const sc = 1.1 + rnd() * 0.25
    const h = (3 + rnd() * 4) * sc
    d += tuftPath(x, y, sc, h)
  }
  const out = [`<path class="gr" d="${d}"/>`]
  for (let i = 0; i < W / 18; i++) {
    const x = rnd() * W
    const y = lerp(top + 6, H - 4, rnd())
    if (inside(x, y, camp.fire, camp.rx * 1.35, camp.ry * 1.7) || inside(x, y, camp.lake.c, camp.lake.rx * 1.5, camp.lake.ry * 1.9)) continue
    if (rnd() < 0.2) out.push(`<ellipse class="rk" cx="${r1(x)}" cy="${r1(y)}" rx="${r1(6 + rnd() * 3)}" ry="${r1(3.5 + rnd())}"/>`)
    else {
      const color = ['fw', 'fy', 'fp'][Math.floor(rnd() * 3)]
      out.push(`<circle class="${color}" cx="${r1(x)}" cy="${r1(y)}" r="2"/><circle class="${color}" cx="${r1(x + 5)}" cy="${r1(y + 2)}" r="1.7"/>`)
    }
  }
  return out.join('')
}

/** Bushes, rocks and flowers over the open ground, kept off the path and smaller toward the horizon. */
function decor(W: number, horizon: number, bottom: number, trail: Trail): string {
  const rnd = seeded('decor')
  const out: string[] = []
  const along = Array.from({ length: 81 }, (_, i) => ({ p: trail.at(i / 80), half: trail.width(i / 80) / 2 }))
  const onPath = (x: number, y: number) => along.some(a => Math.hypot(x - a.p.x, y - a.p.y) < a.half + 24)
  for (let i = 0; i < W / 22; i++) {
    const y = lerp(horizon + 12, bottom - 6, Math.pow(rnd(), 0.8))
    const x = rnd() * W
    if (onPath(x, y)) continue
    const s = lerp(0.4, 1.15, (y - horizon) / (bottom - horizon))
    const kind = rnd()
    if (kind < 0.3) {
      out.push(`<g class="bu" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s * 100) / 100})"><circle cx="-7" cy="-5" r="7"/><circle cx="4" cy="-7" r="9"/><circle cx="12" cy="-4" r="6"/></g>`)
    } else if (kind < 0.42) {
      out.push(`<ellipse class="rk" cx="${r1(x)}" cy="${r1(y - 2 * s)}" rx="${r1(6 * s)}" ry="${r1(3.6 * s)}"/>`)
    } else {
      const color = ['fw', 'fy', 'fp'][Math.floor(rnd() * 3)]
      out.push(`<circle class="${color}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(1.8 * s)}"/><circle class="${color}" cx="${r1(x + 5 * s)}" cy="${r1(y + 2 * s)}" r="${r1(1.5 * s)}"/>`)
    }
  }
  return out.join('')
}

type Spot = { p: P; s: number }

export type TimeOfDay = { phase: 'dawn' | 'golden' | 'day' | 'dusk' | 'night'; arc: number; isMoon: boolean }

/**
 * Sunrise and sunset in local hours for the day of `d`, from the NOAA solar equations.
 * The longitude is guessed from the standard-time zone offset and the latitude defaults to 40°N; both are close enough to put golden hour in the right half hour.
 */
export function sunTimes(d: Date, lat = 40, lon?: number): { rise: number; set: number } {
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset()
  const longitude = lon ?? -(Math.max(jan, jul) / 60) * 15
  const day = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  const g = ((2 * Math.PI) / 365) * (day - 1)
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const rad = (lat * Math.PI) / 180
  const cosH = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(rad) * Math.cos(decl)) - Math.tan(rad) * Math.tan(decl)
  // Polar day or night: fall back to a plain 6-to-18 day rather than leave the sun stuck.
  if (cosH < -1 || cosH > 1) return { rise: 6, set: 18 }
  const ha = (Math.acos(cosH) * 180) / Math.PI
  const local = (utcMin: number) => (((utcMin - d.getTimezoneOffset()) / 60) % 24 + 24) % 24
  return { rise: local(720 - 4 * (longitude + ha) - eq), set: local(720 - 4 * (longitude - ha) - eq) }
}

/**
 * The light follows the viewer's clock and the real sun: dawn the hour before sunrise, golden hour the hour after sunrise
 * and the hour before sunset, dusk the hour after sunset, night beyond. arc is how far the sun or moon has crossed the sky.
 */
export function timeOfDay(now: number): TimeOfDay {
  const d = new Date(now)
  const h = d.getHours() + d.getMinutes() / 60
  const { rise, set } = sunTimes(d)
  const phase = h < rise - 1 || h >= set + 1 ? 'night' : h < rise ? 'dawn' : h < rise + 1 ? 'golden' : h < set - 1 ? 'day' : h < set ? 'golden' : 'dusk'
  // The sun's arc runs a little past the real rise and set, so at golden hour it still hangs low over the mountains.
  const isSun = h >= rise - 0.3 && h < set + 0.3
  const arc = isSun ? (h - (rise - 0.3)) / (set - rise + 0.6) : ((h - (set + 0.3) + 24) % 24) / (24 - (set - rise + 0.6))
  return { phase, arc: clamp(arc, 0, 1), isMoon: !isSun }
}

// Only the light changes with the hour: the sky, a soft tint over everything, the glow along the horizon, and firelight after dark.
// Grass, trees and camp keep their own colours.
const LIGHTING_CSS =
  `.s2{stop-color:#e6eef0}.tint{fill:none}.hg,.fg,.mn,.mns,.sh2{display:none}.h0{stop-color:#ffcf86}.fg0{stop-color:#ffb45a}` +
  `.dawn .s0{stop-color:#7f88bb}.dawn .s2{stop-color:#eab6b2}.dawn .s1{stop-color:#fbe0c2}.dawn .tint{fill:#ff9fb0;opacity:.07}.dawn .sun{fill:#f7ab72}.dawn .hg{display:inline;opacity:.55}.dawn .h0{stop-color:#ffb9a0}` +
  `.golden .s0{stop-color:#8cb2da}.golden .s2{stop-color:#f8d39a}.golden .s1{stop-color:#ffad62}.golden .tint{fill:#ffb35f;opacity:.12}.golden .sun{fill:#ffd36e}.golden .hg{display:inline;opacity:1}.golden .sh2,.dawn .sh2{display:inline;opacity:.85}.golden .cl{fill:#ffe1c2}.dawn .cl{fill:#fbd9d4}` +
  `.dusk .s0{stop-color:#2c3062}.dusk .s2{stop-color:#8e5b8c}.dusk .s1{stop-color:#f0895a}.dusk .tint{fill:#4a3070;opacity:.18}.dusk .hg{display:inline;opacity:.6}.dusk .h0{stop-color:#ff8f5e}.dusk .st{display:inline;opacity:.45}.dusk .fg{display:inline;opacity:.5}.dusk .cl{fill:#c79aa8;opacity:.7}` +
  `.night .s0{stop-color:#060b1f}.night .s2{stop-color:#121d3c}.night .s1{stop-color:#24345a}.night .tint{fill:#0a1430;opacity:.3}.night .st{display:inline}.night .fg{display:inline;opacity:.75}.night .cl{fill:#3a4462;opacity:.55}` +
  `.mn{fill:#efe9d2}.mns{fill:#121d3c}.dusk .mns{fill:#2c3062}.dusk .mn,.dusk .mns,.night .mn,.night .mns{display:inline}`

const MAX_BUSHES = 15
// The wireframe's bush spots in meadow terms: x across the picture, y from the forest edge (0) to the camp (1), in fill order.
const BUSH_LAYOUT: Array<[number, number]> = [
  [0.37, 0.8], [0.26, 0.95], [0.16, 0.78], [0.13, 0.46], [0.24, 0.26], [0.34, 0.52], [0.44, 0.23], [0.54, 0.54],
  [0.6, 0.26], [0.69, 0.51], [0.79, 0.51], [0.85, 0.21], [0.76, 0.15], [0.68, 0.18], [0.59, 0.05],
]

type Trail = { at: (t: number) => P; normal: (t: number) => P; width: (t: number) => number; meadowEnd: number }

/**
 * The trail's centre line: from the clearing's right shoulder it wanders gently across the meadow and up through a gap in
 * the forest to the horizon, never quite straight. Sampled by arc length, so t is distance along it.
 */
function trailCurve(camp: Camp, W: number, horizon: number, meadowTop: number): Trail {
  const campTop = camp.fire.y - camp.ry * 1.2
  // Down from the horizon: x across the picture, v from the horizon (0) to the top of camp (1). Traced from a sketch:
  // nearly straight through the trees, a bend left mid-meadow, then a sweep right that hooks into the camp's shoulder.
  const v = (u: number) => lerp(horizon, campTop, u)
  const knots: P[] = [
    // It stops in the grass just above camp's trampled ring rather than running into the clearing.
    { x: camp.fire.x + camp.rx * 0.72, y: camp.fire.y - camp.ry * 1.3 },
    { x: W * 0.43, y: v(0.91) },
    { x: W * 0.378, y: v(0.77) },
    { x: W * 0.37, y: v(0.66) },
    { x: W * 0.41, y: v(0.52) },
    { x: W * 0.434, y: v(0.36) },
    { x: W * 0.428, y: v(0.16) },
    { x: W * 0.395, y: horizon + 6 },
  ]
  // Catmull-Rom through the knots, densely sampled, then re-indexed by distance.
  const pts: P[] = []
  for (let i = 0; i < knots.length - 1; i++) {
    const p0 = knots[Math.max(0, i - 1)], p1 = knots[i], p2 = knots[i + 1], p3 = knots[Math.min(knots.length - 1, i + 2)]
    for (let j = 0; j < 40; j++) {
      const t = j / 40, t2 = t * t, t3 = t2 * t
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  pts.push(knots[knots.length - 1])
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = len[len.length - 1]
  const at = (t: number): P => {
    const want = clamp(t, 0, 1) * total
    let i = 1
    while (i < len.length - 1 && len[i] < want) i++
    const f = (want - len[i - 1]) / (len[i] - len[i - 1] || 1)
    return { x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f) }
  }
  const normal = (t: number): P => {
    const p = at(Math.max(0, t - 0.005))
    const q = at(Math.min(1, t + 0.005))
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1
    return { x: -(q.y - p.y) / l, y: (q.x - p.x) / l }
  }
  // Wide near camp, a footpath at the horizon.
  const width = (t: number) => lerp(8.1, 43.8, clamp((at(t).y - horizon) / (campTop - horizon), 0, 1))
  // How far along the trail the meadow ends and the forest begins, for placing the bushes.
  const edge = pts.findIndex(p => p.y <= meadowTop)
  const meadowEnd = len[edge < 0 ? len.length - 1 : edge] / total
  return { at, normal, width, meadowEnd }
}

/** A smooth closed path through points, curving through their midpoints so the outline has no corners. */
function smoothClosed(pts: P[]): string {
  const mid = (i: number) => {
    const p = pts[i % pts.length], q = pts[(i + 1) % pts.length]
    return `${r1((p.x + q.x) / 2)} ${r1((p.y + q.y) / 2)}`
  }
  let d = `M${mid(0)}`
  for (let i = 1; i <= pts.length; i++) d += `Q${r1(pts[i % pts.length].x)} ${r1(pts[i % pts.length].y)} ${mid(i)}`
  return d + 'Z'
}

/**
 * The trail as a real footpath: wobbly edges that never run parallel, packed dirt with a paler worn strip down the
 * middle where feet go, gravel and the odd stone, and grass creeping in at the edges. Near camp it narrows to a ragged tip
 * and breaks up into worn patches, the way a path turns back into grass where people stop sticking to it.
 */
function trailMarkup(trail: Trail): string {
  const rnd = seeded('trail')
  const phase = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6]
  const wob = (t: number, a: number, b: number) => 1 + 0.15 * Math.sin(t * 23 + a) + 0.09 * Math.sin(t * 57 + b)
  const edge = (k: number, side: 1 | -1, t: number) => {
    const p = trail.at(t)
    const n = trail.normal(t)
    const tip = Math.pow(clamp(t / 0.09, 0, 1), 0.55)
    const w = (trail.width(t) / 2) * k * tip * (side > 0 ? wob(t, phase[0], phase[1]) : wob(t, phase[2], phase[3]))
    return { x: p.x + n.x * w * side, y: p.y + n.y * w * side }
  }
  const outline = (k: number) => {
    const left: P[] = []
    const right: P[] = []
    for (let i = 0; i <= 48; i++) {
      left.push(edge(k, 1, i / 48))
      right.push(edge(k, -1, i / 48))
    }
    return smoothClosed([...left, ...right.reverse()])
  }
  const out = [`<path class="tr0" d="${outline(1.08)}"/>`, `<path class="tr1" d="${outline(1)}"/>`, `<path class="tr2" d="${outline(0.42)}"/>`]
  // Past the tip the ground is only worn, not cut: a few bare patches shrinking toward camp, a little stray gravel.
  const a = trail.at(0)
  const back = trail.normal(0)
  const down = { x: back.y, y: -back.x }
  let worn = ''
  for (let i = 1; i <= 5; i++) {
    const d = i * 9 + rnd() * 4
    const side = (rnd() - 0.5) * 14
    const x = a.x + down.x * d + back.x * side, y = a.y + down.y * d + back.y * side
    worn += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1((9 - i * 1.3) * (0.8 + rnd() * 0.4))}" ry="${r1((3.6 - i * 0.5) * (0.8 + rnd() * 0.4))}"/>`
  }
  out.push(`<g class="tr1">${worn}</g>`)
  // Gravel thins out with distance; a few larger stones sit near the edges.
  let gravel = ''
  let stones = ''
  for (let i = 0; i < 90; i++) {
    const t = 0.03 + Math.pow(rnd(), 1.4) * 0.97
    const p = trail.at(t)
    const n = trail.normal(t)
    const w = trail.width(t) / 2
    const o = (rnd() * 2 - 1) * w * 0.85
    const r = lerp(1.1, 0.4, t) * (0.7 + rnd() * 0.6)
    const x = p.x + n.x * o, y = p.y + n.y * o
    if (i % 9 === 0) stones += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(r * 2.2)}" ry="${r1(r * 1.4)}"/>`
    else gravel += `M${r1(x)} ${r1(y)}h${r1(r)}`
  }
  out.push(`<path class="tr3" d="${gravel}"/>`, `<g class="tr4">${stones}</g>`)
  // Grass tufts nibbling at both edges.
  let tufts = ''
  for (let i = 0; i < 34; i++) {
    const t = i < 10 ? rnd() * 0.12 : 0.06 + rnd() * 0.85
    const side = i % 2 ? 1 : -1
    const q = edge(1, side as 1 | -1, t)
    const h = lerp(5, 2, t) * (0.7 + rnd() * 0.6)
    tufts += `M${r1(q.x)} ${r1(q.y)}l${r1(-h * 0.4)} ${r1(-h)}M${r1(q.x)} ${r1(q.y)}l${r1(h * 0.1)} ${r1(-h * 1.2)}M${r1(q.x)} ${r1(q.y)}l${r1(h * 0.5)} ${r1(-h * 0.9)}`
  }
  out.push(`<path class="tr5" d="${tufts}"/>`)
  return out.join('')
}

/** A root file as a bush beside the trail: berries once it has been edited, a pulse while it is being read. */
function bushMarkup(name: string, path: string, at: P, s: number, c: Ctx): string {
  const t = c.touches[path]
  const age = t ? c.now - t.at : Infinity
  const pulse = age < READ_GLOW_MS ? ` class="pu" style="animation-delay:-${Math.round(age)}ms"` : ''
  const berries = t?.kind === 'write' ? '<circle class="by" cx="-4" cy="-7" r="1.6"/><circle class="by" cx="3" cy="-10" r="1.6"/><circle class="by" cx="7" cy="-5" r="1.5"/>' : ''
  return (
    `<g transform="translate(${r1(at.x)} ${r1(at.y)}) scale(${r1(s * 100) / 100})"${pulse}>` +
    `<ellipse class="sh" cx="0" cy="1" rx="13" ry="3"/><circle class="b1" cx="-6" cy="-5" r="7"/><circle class="b2" cx="5" cy="-6" r="8"/><circle class="b3" cx="0" cy="-10" r="7"/>${berries}` +
    `<text class="tx lb bl" x="0" y="11" text-anchor="middle" font-size="8.5">${xml(clipEnd(name, 14))}</text></g>`
  )
}
export type Drawn = { svg: string; height: number; seats: Record<string, P>; radio: P }
type Camp = { fire: P; rx: number; ry: number; lake: { c: P; rx: number; ry: number }; lakeFrom: number; seats: Spot[]; bottom: number; radio: { p: P; s: number } }

export const SEATS = 21
const TREE_SPOTS = 15
const BUSH_SPOTS = 15

/** Which of `spots` slots n things take: every spots/n-th, so a few things spread out rather than bunch at the start. */
export function ratioSpots(n: number, spots: number): number[] {
  return Array.from({ length: Math.min(n, spots) }, (_, k) => Math.min(spots - 1, Math.round((k * spots) / Math.max(1, n))))
}

function fileCount(node: FNode): number {
  return (node.children ?? []).reduce((a, c) => a + (c.kind === 'file' ? 1 : fileCount(c)), 0)
}

// Seats at the fire (the lead's included), then stumps around the lake.
const FIRE_RINGS = [[5, 0.55, 0], [8, 1, 0.5]] as const
const LAKE_SPOTS = 8

/** Spots around an ellipse, the first at the front, the rest alternating left and right of it. */
function ring(c: P, rx: number, ry: number, n: number, half: number): P[] {
  const step = (2 * Math.PI) / n
  return Array.from({ length: n }, (_, i) => {
    const m = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1)
    const a = Math.PI / 2 + (m + (half ? (i % 2 ? half : -half) : 0)) * step
    return { x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry }
  })
}

/** The campfire fills the left two thirds and the lake the right third; the lead sits front and centre at the fire. */
function campLayout(W: number, H: number, campH: number): Camp {
  const fire = { x: W * 0.32, y: H - campH * 0.5 }
  const rx = Math.min(W * 0.22, campH * 2)
  const ry = campH * 0.38
  const lake = { c: { x: W * 0.8, y: H - campH * 0.52 }, rx: Math.min(W * 0.12, campH * 1.1), ry: campH * 0.24 }
  const depthOf = (p: P) => lerp(0.72, 1.05, (p.y - (fire.y - ry)) / (2 * ry))
  const seats: Spot[] = []
  for (const [n, k, half] of FIRE_RINGS) for (const p of ring(fire, rx * k, ry * k, n, half)) seats.push({ p, s: depthOf(p) })
  for (const p of ring(lake.c, lake.rx * 1.22, lake.ry * 1.42, LAKE_SPOTS, 0)) seats.push({ p, s: depthOf(p) })
  // In the gap between the trampled ring and the lake's stumps, a little in front of the fire.
  const gapL = fire.x + rx * 1.24, gapR = lake.c.x - lake.rx * 1.22 - 10
  // Stands 50px below the fire's front row of seats, but never off the bottom of the picture.
  const rp = { x: lerp(gapL, gapR, 0.3), y: Math.min(H - 4, fire.y + ry * 0.7 + 50) }
  return { fire, rx, ry, lake, lakeFrom: seats.length - LAKE_SPOTS, seats, bottom: H, radio: { p: rp, s: depthOf({ x: rp.x, y: fire.y + ry * 0.7 }) * 2.54 } }
}

function campMarkup(camp: Camp, now: number, lakeLife = ''): string {
  const { fire, rx, ry, lake } = camp
  const at = (p: P, inner: string, scale = 1) => `<g transform="translate(${r1(p.x)} ${r1(p.y)})${scale === 1 ? '' : ` scale(${r1(scale * 100) / 100})`}">${inner}</g>`
  // The trampled ring reaches about 1.7 ry at its widest wobble; squash it so it ends above the picture's bottom edge.
  const out: string[] = [at(fire, clearing.draw(rx, Math.min(ry, (camp.bottom - fire.y - 4) / 1.7))), at(lake.c, lake_.draw(lake.rx, lake.ry, now)), lakeLife]
  const seatMarkup = (seat: Spot, i: number) => at(seat.p, i >= camp.lakeFrom ? stump.draw(i - camp.lakeFrom) : log.draw(i), seat.s)
  const back = camp.seats.map((seat, i) => ({ seat, i })).sort((a, b) => a.seat.p.y - b.seat.p.y)
  for (const { seat, i } of back) if (seat.p.y < fire.y) out.push(seatMarkup(seat, i))
  out.push(at(fire, fireArt.draw(now), 1.25), at(camp.radio.p, radio.draw(), camp.radio.s))
  for (const { seat, i } of back) if (seat.p.y >= fire.y) out.push(seatMarkup(seat, i))
  return out.join('')
}
type R = [x: number, y: number, w: number, h: number, cls: string]

// Clawd on a 14 x 10 grid: body, side arms, four legs, two tall eyes.
const BODY: R[] = [
  [1, 2, 12, 6, 'cb'], [0, 4, 1, 2, 'cb'], [13, 4, 1, 2, 'cb'],
  [2, 8, 1, 2, 'cb'], [4, 8, 1, 2, 'cb'], [9, 8, 1, 2, 'cb'], [11, 8, 1, 2, 'cb'],
  [4, 3, 1, 2, 'ce'], [9, 3, 1, 2, 'ce'],
]
const OUTFIT: Record<string, R[]> = {
  lead: [[4, 0, 6, 2, 'o-gold'], [4, -1, 1, 1, 'o-gold'], [6, -1, 2, 1, 'o-gold'], [9, -1, 1, 1, 'o-gold']],
  explorer: [[0, 1, 14, 1, 'o-khaki'], [3, -1, 8, 2, 'o-khaki2'], [3, 0, 8, 1, 'o-band']],
  developer: [[2, 0, 10, 1, 'o-dark'], [1, 1, 1, 1, 'o-dark'], [12, 1, 1, 1, 'o-dark'], [0, 2, 2, 3, 'o-dark'], [12, 2, 2, 3, 'o-dark']],
  // A navy suit with a white shirt and red tie, suit sleeves and trousers, still holding the blueprint.
  planner: [
    [1, 5, 12, 3, 'o-suit'], [0, 4, 1, 2, 'o-suit'], [13, 4, 1, 2, 'o-suit'], [5, 5, 4, 2, 'o-shirt'], [6, 5, 2, 3, 'o-tie'],
    [2, 8, 1, 2, 'o-suit'], [4, 8, 1, 2, 'o-suit'], [9, 8, 1, 2, 'o-suit'], [11, 8, 1, 2, 'o-suit'],
    [13, 3, 3, 1, 'o-paper'], [13, 4, 3, 1, 'o-paper2'],
  ],
  // Glasses.
  reviewer: [
    [3, 2, 3, 1, 'o-dark'], [3, 5, 3, 1, 'o-dark'], [3, 3, 1, 2, 'o-dark'], [5, 3, 1, 2, 'o-dark'],
    [8, 2, 3, 1, 'o-dark'], [8, 5, 3, 1, 'o-dark'], [8, 3, 1, 2, 'o-dark'], [10, 3, 1, 2, 'o-dark'], [6, 3, 2, 1, 'o-dark'],
  ],
  // A crash test dummy: yellow all over, black joints, and the black-and-yellow target marks on the head and side.
  tester: [
    [1, 2, 12, 6, 'o-dum'], [0, 4, 1, 2, 'o-dum'], [13, 4, 1, 2, 'o-dum'],
    [2, 8, 1, 2, 'o-dumj'], [4, 8, 1, 2, 'o-dumj'], [9, 8, 1, 2, 'o-dumj'], [11, 8, 1, 2, 'o-dumj'], [1, 6, 12, 1, 'o-dumj'],
    [4, 3, 1, 2, 'ce'], [9, 3, 1, 2, 'ce'],
    [11, 2, 1, 1, 'o-dark'], [12, 3, 1, 1, 'o-dark'], [12, 2, 1, 1, 'o-tgt'], [11, 3, 1, 1, 'o-tgt'],
    [1, 4, 1, 1, 'o-dark'], [2, 5, 1, 1, 'o-dark'], [2, 4, 1, 1, 'o-tgt'], [1, 5, 1, 1, 'o-tgt'],
  ],
  // A tilted red beret, and a palette with a brush in the right hand.
  artist: [[3, 0, 8, 2, 'o-red'], [2, 1, 1, 1, 'o-red'], [11, 1, 1, 1, 'o-red'], [9, -1, 1, 1, 'o-red'], [13, 4, 3, 2, 'o-wood'], [13, 4, 1, 1, 'o-p1'], [15, 4, 1, 1, 'o-p2'], [14, 5, 1, 1, 'o-p3'], [15, 1, 1, 3, 'o-wood'], [15, 0, 1, 1, 'o-p1']],
}
export const ROLE_NAME: Record<string, string> = { lead: 'Lead', explorer: 'Explorer', developer: 'Developer', planner: 'Planner', reviewer: 'Reviewer', tester: 'Tester', artist: 'Artist' }

/** Clawd in a role's outfit, u pixels per grid cell, standing with its feet on (0, 0). */
const outfitOf = (role: string) => (role in OUTFIT ? role : 'developer')

/** One Clawd per outfit in use, drawn once in the defs; every agent wearing it is then a single <use>. */
function clawdDefs(roles: Iterable<string>, u: number): string {
  return [...new Set([...roles].map(outfitOf))]
    .map(role => {
      const rects = [...BODY, ...OUTFIT[role]]
      return `<g id="cw-${role}" transform="scale(${u}) translate(-7 -10)" shape-rendering="crispEdges">${rects.map(([x, y, w, h, cls]) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>`
    })
    .join('')
}

const clawd = (role: string) => `<use href="#cw-${outfitOf(role)}"/>`

function scenery(W: number, top: number, horizon: number, now: number, tod: TimeOfDay): string {
  const rnd = seeded('scenery')
  const sky = horizon - top
  const out: string[] = []
  // Stars show only at night. The sun or moon rides an arc across the sky by the hour, and sets behind the mountains.
  let stars = ''
  for (let i = 0; i < 40; i++) stars += `M${r1(rnd() * W)} ${r1(top + rnd() * sky * 0.7)}h.01`
  const r = Math.min(24, sky * 0.13)
  const x = lerp(W * 0.06, W * 0.94, tod.arc)
  const y = horizon + r * 0.4 - Math.sin(tod.arc * Math.PI) * sky * 0.78
  const isMoon = tod.isMoon
  out.push(`<path class="st" d="${stars}"/>`)
  // The glow sits on the horizon below the sun, or mid-sky once the sun has set, and shows only in the warm phases.
  out.push(`<ellipse class="hg" cx="${r1(isMoon ? W * 0.9 : x)}" cy="${r1(horizon)}" rx="${r1(W * 0.55)}" ry="${r1(sky * 0.5)}" fill="url(#hgg)"/>`)
  out.push(
    isMoon
      ? `<circle class="mn" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 0.8)}"/><circle class="mns" cx="${r1(x + r * 0.32)}" cy="${r1(y - r * 0.18)}" r="${r1(r * 0.7)}"/>`
      : `<circle class="sh2" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 3)}" fill="url(#hgg)"/><circle class="sun" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`,
  )
  // Clouds drift on a clock of their own; the delay is taken from the wall clock so a redraw doesn't snap them back.
  for (let i = 0; i < 4; i++) {
    const dur = 120 + rnd() * 90
    const y = top + sky * (0.12 + rnd() * 0.35)
    const sc = 0.7 + rnd() * 0.7
    const delay = -(((now / 1000) + rnd() * dur) % dur)
    out.push(
      `<g class="cl" style="animation-duration:${r1(dur)}s;animation-delay:${r1(delay)}s"><g transform="translate(0 ${r1(y)}) scale(${r1(sc * 100) / 100})">` +
        `<ellipse cx="0" cy="0" rx="34" ry="10"/><ellipse cx="-14" cy="-6" rx="16" ry="11"/><ellipse cx="10" cy="-9" rx="18" ry="13"/></g></g>`,
    )
  }
  // The Rockies around Banff: limestone peaks with snow, a nearer range, and a treeline of spires at the horizon.
  out.push(mountains.draw(W, horizon, top))
  return out.join('')
}

type Item = { tree: FNode; art: TreeArt; z: number; x: number; k: number }
type TrailPt = { p: P; w: number }

// More folders than this keep the full three-row forest; fewer zoom in on its front rows.
const SMALL_REPO = 8
// A small repo's front row stands out in the meadow, this far from the forest's edge toward camp, every other tree a step back.
const FRONT_AT = [0.6, 0.47]
const MID_Z = 0.06
// The biggest tree's height as a share of the room above the front row, for 1 to 8 folders.
const ZOOM = [0.92, 0.92, 0.9, 0.88, 0.86, 0.84, 0.82, 0.8]
// How many of the 1 to 8 folders stand in the front row; the rest step back to the middle row.
const FRONT_ROW = [1, 2, 3, 4, 3, 3, 4, 4]
// Roughly the smallest tree's height as a share of the biggest's in a small repo; a big repo keeps true proportions, as it has plenty of big trees already.
const TREE_FLOOR = [0.5, 0]

/** A tree's drawn height as a share of the biggest tree's, softly floored so a 3-file folder still grows a real tree. */
export function treeShare(r: number, n = 1): number {
  const floor = TREE_FLOOR[n > SMALL_REPO ? 1 : 0]
  return Math.cbrt(r ** 3 + floor ** 3) / Math.cbrt(1 + floor ** 3)
}

/** The trail's left and right edges across a band of heights. */
function trailSpan(trail: TrailPt[], y0: number, y1: number): [number, number] {
  let l = Infinity, r = -Infinity
  for (const q of trail) if (q.p.y >= y0 && q.p.y <= y1) l = Math.min(l, q.p.x - q.w / 2), r = Math.max(r, q.p.x + q.w / 2)
  if (l <= r) return [l, r]
  const q = trail.reduce((a, b) => (Math.abs(b.p.y - y1) < Math.abs(a.p.y - y1) ? b : a))
  return [q.p.x - q.w / 2, q.p.x + q.w / 2]
}

/**
 * Where each folder's tree stands and how big. A big repo fills fifteen spots in three rows; a small one zooms in,
 * with bigger trees out in the meadow either side of the trail, so agents' walks stay short and in view.
 */
function placeTrees(
  f: Forest, art: { now: number; touches: Record<string, Touch>; maxTufts: number }, W: number, top: number, horizon: number,
  campTop: number, groundAt: (z: number) => number, depth: (z: number) => number, trail: TrailPt[],
): Item[] {
  const biggest = f.trees.filter(t => t.path !== '').sort((a, b) => fileCount(b) - fileCount(a) || a.path.localeCompare(b.path)).slice(0, TREE_SPOTS)
  const items: Item[] = biggest.map(tree => ({ tree, art: drawTree(tree, art), z: 0, x: 0, k: 1 }))
  const n = items.length
  if (!n) return items
  const hMax = Math.max(...items.map(it => it.art.height))
  // Each tree's scale relative to the shared one, lifting small folders toward the floor.
  const lift = items.map(it => (treeShare(it.art.height / hMax, n) * hMax) / it.art.height)
  const halfW = (it: Item) => ((it.art.maxX - it.art.minX) / 2) * it.k * depth(it.z)
  // Half the width a trunk needs clear: its name, or a sliver of its crown, whichever is wider.
  const trunkRoom = (it: Item) => Math.max((clip(it.tree.name, 22).length * Math.max(8, 11 * Math.min(1, depth(it.z)))) / 3.6, halfW(it) * 0.25) + 6

  if (n > SMALL_REPO) {
    // Fifteen spots in three rows that snake back to front: left to right at the back, right to left in the middle,
    // left to right at the front. Folders, biggest first, take every 15/n-th spot.
    const spots = ratioSpots(n, TREE_SPOTS)
    items.forEach((it, i) => {
      const row = Math.floor(spots[i] / 5)
      const col = row === 1 ? 4 - (spots[i] % 5) : spots[i] % 5
      // Each row is shifted a third of a column from the others, so no tree stands straight behind another.
      it.z = [0.84, 0.46, 0.08][row]
      it.x = [0.09, 0.18, 0.135][row] + col * 0.18
    })
    // One scale for the whole forest, so the biggest folders really do read biggest; each must clear the top and fit its column.
    let k = 1.6
    items.forEach((it, i) => {
      const ds = depth(it.z) * lift[i]
      k = Math.min(k, (groundAt(it.z) - top - 6) / (it.art.height * ds), (W * 0.27) / ((it.art.maxX - it.art.minX) * ds))
    })
    items.forEach((it, i) => (it.k = Math.max(k, 0.2) * lift[i]))
    for (const it of items) {
      const gy = groundAt(it.z)
      const [l, r] = trailSpan(trail, gy - 6, gy + 6)
      const clear = 16 * depth(it.z)
      const x = it.x * W
      if (x > l - clear && x < r + clear) it.x = (x < (l + r) / 2 ? l - clear : r + clear) / W
    }
    return items
  }

  // Out in the meadow z goes below 0, the same straight line groundAt and depth already follow.
  const zAt = (y: number) => (y - groundAt(0)) / (groundAt(1) - groundAt(0))
  const front = (i: number) => i < FRONT_ROW[n - 1]
  const frontZ = FRONT_AT.map(a => zAt(lerp(groundAt(0), campTop, a)))
  // Zoomed in: the biggest tree takes a set share of the room above the front row, shrinking only until everyone fits.
  let D = (ZOOM[n - 1] * (groundAt(frontZ[0]) - top)) / depth(frontZ[0])
  for (let tries = 0; tries < 30; tries++, D *= 0.94) {
    const done: Item[] = []
    for (const [i, it] of items.entries()) {
      it.z = front(i) ? frontZ[i % 2] : MID_Z
      const ds = depth(it.z)
      const gy = groundAt(it.z)
      it.k = Math.min((D / hMax) * lift[i], (gy - top - 6) / (it.art.height * ds))
      if (it.art.species === 'aspen') it.art = drawTree(it.tree, { ...art, scale: it.k * ds })
      const hw = halfW(it)
      const [l, r] = trailSpan(trail, Math.max(horizon, gy - it.art.height * it.k * ds), gy)
      const gap = 10 * ds
      // Trees side by side may brush crowns; of two at different depths, the further one's trunk and name stay out from under the nearer crown.
      const fits = (x: number) =>
        x - hw * 0.5 >= 0 &&
        x + hw * 0.5 <= W &&
        done.every(d => {
          const dx = Math.abs(x - d.x * W)
          if (d.z === it.z) return dx >= (hw + halfW(d)) * 0.7
          return d.z < it.z ? dx >= halfW(d) * 1.05 + trunkRoom(it) : dx >= hw * 1.05 + trunkRoom(d)
        })
      // The nearest free spot out from each edge of the trail, its distance weighed against that side's room so both sides fill evenly.
      const nearest = (side: 1 | -1) => {
        for (let d = 0; d < W; d += 2) {
          const x = side > 0 ? r + gap + hw + d : l - gap - hw - d
          if (fits(x)) return { x, cost: d / Math.max(1, side > 0 ? W - r : l) }
        }
        return null
      }
      const right = nearest(1), left = nearest(-1)
      const spot = right && (!left || right.cost <= left.cost) ? right : left
      if (!spot) break
      it.x = spot.x / W
      done.push(it)
    }
    if (done.length === n) break
  }
  return items
}

/**
 * Spots for a small repo's root-file bushes: both sides of the trail through the meadow, nearest camp first, spread
 * along it in rows stepping outward. None sits behind a crown, over a tree's name, or on the trail.
 */
function trailsideBushes(m: number, trail: TrailPt[], [y0, y1]: number[], W: number, trees: Array<{ x: number; y: number; halfW: number; height: number }>): P[] {
  if (!m) return []
  const dsAt = (y: number) => lerp(0.62, 0.85, clamp((y - y0) / (y1 - y0), 0, 1))
  const free = (x: number, y: number) => {
    const ds = dsAt(y)
    return (
      x > 24 && x < W - 24 && y >= y0 && y <= y1 &&
      !trail.some(q => Math.hypot(q.p.x - x, q.p.y - y) < q.w / 2 + 15 * ds + 2) &&
      !trees.some(t =>
        y < t.y + 4 ? y > t.y - t.height && Math.abs(x - t.x) < t.halfW * (1 - (t.y - y) / t.height) + 16 * ds : y < t.y + 40 && Math.abs(x - t.x) < 48,
      )
    )
  }
  const rows: P[][] = [[], [], []]
  let walked = 0
  for (let i = 1, last = -Infinity; i < trail.length - 1; i++) {
    walked += Math.hypot(trail[i].p.x - trail[i - 1].p.x, trail[i].p.y - trail[i - 1].p.y)
    if (walked - last < 40) continue
    last = walked
    const a = trail[i - 1].p, b = trail[i + 1].p, l = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l
    rows.forEach((row, r) => {
      for (const side of [1, -1]) {
        const off = (trail[i].w / 2 + 18 * dsAt(trail[i].p.y)) * (1 + r * 1.6)
        const p = { x: trail[i].p.x + nx * off * side, y: trail[i].p.y + ny * off * side }
        if (free(p.x, p.y)) row.push(p)
      }
    })
  }
  // The nearest row first, spread evenly along the trail, then the next row out for whoever is left; no two names may touch.
  const out: P[] = []
  const apart = (p: P) => out.every(q => Math.abs(p.x - q.x) > 72 * dsAt(p.y) || Math.abs(p.y - q.y) > 26)
  for (const row of rows) {
    const pool = row.filter(apart)
    for (const k of ratioSpots(m - out.length, pool.length)) if (apart(pool[k])) out.push(pool[k])
    if (out.length >= m) break
  }
  // Any left over take the free ground nearest the trail, anywhere in the meadow, and at worst stand closer together.
  if (out.length >= m) return out
  const spare: Array<P & { d: number }> = []
  for (let y = y0; y <= y1; y += 13) for (let x = 30; x < W - 30; x += 16) if (free(x, y)) spare.push({ x, y, d: Math.min(...trail.map(q => Math.hypot(q.p.x - x, q.p.y - y))) })
  spare.sort((a, b) => a.d - b.d)
  for (const p of spare) if (out.length < m && apart(p)) out.push(p)
  for (const p of spare) if (out.length < m && !out.includes(p)) out.push(p)
  return out
}

function attempt(f: Forest, pins: Pin[], touches: Record<string, Touch>, now: number, W: number, H: number, o: Opts): Drawn {
  const c: Ctx = { o, touches, now }
  const tod = timeOfDay(now)
  const shown = pins
  // The campground fills the foreground; the forest grows behind it.
  const campH = clamp(H * 0.3, 150, 280)
  const sceneBottom = H - campH
  const camp = campLayout(W, H, campH)
  const top = 0
  const horizon = top + (sceneBottom - top) * 0.34
  // Bands from the back: mountains, forest, a meadow where the bushes grow, then camp.
  const meadowTop = horizon + (sceneBottom - horizon) * 0.62
  const bottom = meadowTop
  const depth = (z: number) => lerp(1, 0.5, z)
  const groundAt = (z: number) => lerp(bottom, horizon + 10, z)

  // The trail leaves the clearing off the fire's right shoulder, so nothing rises straight out of the flames,
  // and winds back to the middle of the forest, narrowing with distance.
  const trail = trailCurve(camp, W, horizon, meadowTop)
  const trailPts = Array.from({ length: 160 }, (_, i) => ({ p: trail.at(i / 159), w: trail.width(i / 159) }))
  const campTop = camp.fire.y - camp.ry * 1.2
  const items = placeTrees(f, { now, touches, maxTufts: o.maxTufts }, W, top, horizon, campTop, groundAt, depth, trailPts)
  const parts: string[] = [
    `<rect x="0" y="0" width="${W}" height="${r1(horizon)}" fill="url(#sky)"/>`,
    scenery(W, top, horizon, now, tod),
    `<rect x="0" y="${r1(horizon)}" width="${W}" height="${r1(H - horizon)}" fill="url(#gd)"/>`,
    trailMarkup(trail),
    grass(W, horizon, sceneBottom),
    decor(W, horizon, sceneBottom, trail),
    campGround(W, sceneBottom, H, camp),
  ]
  const rootFiles = (f.trees.find(t => t.path === '')?.children ?? []).filter(n => n.kind === 'file').slice(0, MAX_BUSHES)
  const campParts: string[] = []
  const nodes = new Map<string, Spot>()
  const ground = new Map<string, Spot>()
  const placed = items.map(it => ({ x: it.x * W, y: groundAt(it.z), z: it.z, halfW: ((it.art.maxX - it.art.minX) / 2) * it.k * depth(it.z), height: it.art.height * it.k * depth(it.z) }))
  // Trees and bushes paint back to front together, since a small repo's trees stand out among the bushes.
  const layers: Array<{ y: number; svg: string }> = []
  for (const it of [...items].sort((a, b) => b.z - a.z || a.x - b.x)) {
    const ds = depth(it.z)
    const s = it.k * ds
    const sx = it.x * W
    const gy = groundAt(it.z)
    // Agents and names out in the meadow stay forest-edge size, so they never outgrow the ones sitting at camp.
    const near = Math.min(ds, 1)
    // Distant trees take only a touch of haze, so the back row still reads as solid forest.
    let svg = `<g transform="translate(${r1(sx)} ${r1(gy)}) scale(${r1(s * 1000) / 1000})" opacity="${r1(lerp(1, 0.95, Math.max(0, it.z)) * 100) / 100}">${it.art.svg}</g>`
    for (const [key, p] of it.art.nodes) nodes.set(key, { p: { x: sx + p.x * s, y: gy + p.y * s }, s: near })
    ground.set(it.tree.path, { p: { x: sx, y: gy }, s: near })
    svg += `<text class="tx lb" x="${r1(sx)}" y="${r1(gy + 6 + 9 * near)}" text-anchor="middle" font-size="${r1(Math.max(8, 11 * near))}">${xml(clip(it.tree.name, 22))}</text>`
    layers.push({ y: gy, svg })
  }
  // Files at the repo's root grow as bushes along the trail; the root's own "ground" is where the trail leaves camp.
  ground.set('', { p: trail.at(0), s: 1 })
  const bushY = [meadowTop + 12, campTop - 8]
  const beside = items.length > SMALL_REPO ? [] : trailsideBushes(rootFiles.length, trailPts, bushY, W, placed)
  // A big repo keeps the fifteen bush spots weaving across the meadow from the approved wireframe; root files take every 15/m-th, like the trees.
  // A spot that would land on the trail is pushed out to just beside it, so no bush ever sits in the path.
  const bushSpots = ratioSpots(rootFiles.length, BUSH_SPOTS)
  rootFiles.forEach((file, i) => {
    const [fx, fy] = BUSH_LAYOUT[bushSpots[i]]
    const at = beside[i] ? { ...beside[i] } : { x: fx * W, y: lerp(bushY[0], bushY[1], fy) }
    const ds = lerp(0.62, 0.85, clamp((at.y - bushY[0]) / (bushY[1] - bushY[0]), 0, 1))
    const near = trailPts.reduce((best, q) => (Math.hypot(q.p.x - at.x, q.p.y - at.y) < Math.hypot(best.p.x - at.x, best.p.y - at.y) ? q : best))
    const clear = near.w / 2 + 15 * ds + 2
    const dx = at.x - near.p.x
    if (Math.abs(dx) < clear) at.x = near.p.x + (dx < 0 ? -clear : clear)
    nodes.set(file.path, { p: { x: at.x, y: at.y - 8 * ds }, s: ds })
    layers.push({ y: at.y, svg: bushMarkup(file.name, file.path, at, ds, c) })
  })
  // The unlabeled forest around the repo's trees, painted just behind them.
  const backdropSvg = backdrop.draw({ W, H, horizon, meadowTop, groundAt, depth, trees: placed, trail: trailPts })
  const firstGround = ground.get('') ?? ground.values().next().value ?? { p: { x: W / 2, y: bottom }, s: 1 }

  // A spot in the water or by the fire, picked from the agent's id so several agents spread out and none jump about.
  const nearBy = (pin: Pin, c: P, rx: number, ry: number, k: number, arc = [0, 2]): Spot => {
    const r = seeded(pin.id)
    const a = Math.PI * (arc[0] + r() * (arc[1] - arc[0]))
    const d = k * (0.45 + r() * 0.5)
    const p = { x: c.x + Math.cos(a) * rx * d, y: c.y + Math.sin(a) * ry * d }
    return { p, s: lerp(0.8, 1.05, (p.y - (camp.fire.y - camp.ry)) / (2 * camp.ry)) }
  }
  const perch = (pin: Pin, spot: string): Spot => {
    // Agents wade in the front half of the lake; the back half belongs to the moose and the loon.
    if (spot.startsWith('l:')) return nearBy(pin, camp.lake.c, camp.lake.rx, camp.lake.ry, 0.75, [0.08, 0.92])
    // By the fire means just in front of the stones, on the near side, where the flames can't hide them.
    if (spot.startsWith('m:')) return nearBy(pin, { x: camp.fire.x, y: camp.fire.y + 4 }, camp.rx, camp.ry, 0.5, [0.12, 0.88])
    // Home is the agent's own seat at the campfire.
    if (spot.startsWith('f:')) {
      const seat = camp.seats[pin.seat ?? 0] ?? camp.seats[0]
      return { p: { x: seat.p.x, y: seat.p.y - 3 * seat.s }, s: seat.s * 1.05 }
    }
    if (spot.startsWith('n:')) {
      let path = spot.slice(2)
      for (;;) {
        const n = nodes.get(path)
        if (n) return { p: { x: n.p.x + 6 * n.s, y: n.p.y + 2 * n.s }, s: n.s * 1.1 }
        if (!path.includes('/')) break
        path = path.slice(0, path.lastIndexOf('/'))
      }
      spot = `g:${treeKey(f, spot.slice(2))}`
    }
    const gr = ground.get(spot.slice(2)) ?? firstGround
    return { p: { x: gr.p.x + 22 * gr.s, y: gr.p.y }, s: gr.s * 1.1 }
  }

  // Sprites sharing a spot in the forest stand side by side instead of on top of each other.
  const crowd = new Map<string, number>()
  const styles: string[] = []
  const sprites: string[] = []
  const bubbles: Array<{ lift: number; svg: string }> = []
  const placedBubbles: Array<{ x0: number; x1: number; y0: number; y1: number }> = []
  // Seats, the fire and names, back to front; an empty seat stays a log to sit on.
  // The animals' world, from where everything else ended up.
  const bushPts = rootFiles.map(file => nodes.get(file.path)!.p)
  const trunks = [...ground.entries()].filter(([key]) => key !== '').map(([, g]) => g.p)
  const inEllipse = (x: number, y: number, c: P, rx: number, ry: number) => ((x - c.x) / rx) ** 2 + ((y - c.y) / ry) ** 2 < 1
  const world: wildlife.World = {
    W,
    H,
    now,
    horizon,
    peaks: top + (horizon - top) * 0.12,
    meadow: { x0: W * 0.03, x1: W * 0.97, y0: meadowTop + 10, y1: campTop - 10 },
    forestEdge: { x0: W * 0.03, x1: W * 0.97, y0: groundAt(0.3), y1: meadowTop + 12 },
    lake: { c: camp.lake.c, rx: camp.lake.rx, ry: camp.lake.ry },
    depth: (y: number) => lerp(0.5, 1, clamp((y - horizon) / (campTop - horizon), 0, 1)),
    isClear: (x: number, y: number, r: number) =>
      !trailPts.some(q => Math.hypot(q.p.x - x, q.p.y - y) < q.w / 2 + r) &&
      !bushPts.some(b => Math.hypot(b.x - x, b.y + 8 - y) < 16 + r) &&
      !trunks.some(t => Math.abs(t.x - x) < 10 + r && Math.abs(t.y - y) < 8 + r) &&
      // Animals paint over the trees, so none may stand on ground a crown should be hiding.
      !placed.some(t => y < t.y && y > t.y - t.height && Math.abs(t.x - x) < t.halfW * (1 - (t.y - y) / t.height) + r) &&
      !inEllipse(x, y, camp.fire, camp.rx * 1.3 + r, camp.ry * 1.7 + r) &&
      !inEllipse(x, y, camp.lake.c, camp.lake.rx * 1.35 + r, camp.lake.ry * 1.6 + r),
  }
  const life = o.wildlife === false ? null : world
  campParts.push(campMarkup(camp, now, life ? wildlife.drawLayer('lake', life) : ''))
  const seats: Record<string, P> = {}
  const names: string[] = []
  for (const pin of shown) {
    const seat = camp.seats[pin.seat ?? -1]
    if (!seat) continue
    seats[pin.id] = seat.p
    const isHome = pin.spot.startsWith('f:')
    names.push(`<text class="tx lb${isHome && !pin.endedAt ? '' : ' nm-away'}" x="${r1(seat.p.x)}" y="${r1(seat.p.y + 14 * seat.s)}" text-anchor="middle" font-size="${r1(10.5 * seat.s)}" font-weight="${pin.id === 'main' ? 700 : 500}">${xml(clipEnd(pin.id === 'main' ? 'Claude' : pin.label, 15))}</text>`)
  }

  // Nearer sprites paint over farther ones; anyone mid-hop paints over everyone.
  const order = shown.map((pin, i) => ({ pin, i, y: perch(pin, pin.spot).p.y, moving: now - pin.movedAt < MOVE_MS })).sort((a, b) => Number(a.moving) - Number(b.moving) || a.y - b.y)
  order.forEach(({ pin, i }) => {
    const to = perch(pin, pin.spot)
    if (!/^[flm]:/.test(pin.spot)) {
      const key = `${Math.round(to.p.x)},${Math.round(to.p.y)}`
      const n = crowd.get(key) ?? 0
      crowd.set(key, n + 1)
      to.p.x += (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 22 * to.s
    }
    const from = perch(pin, pin.from)
    const elapsed = now - pin.movedAt
    let style = ''
    if (elapsed < MOVE_MS && (Math.abs(from.p.x - to.p.x) > 1 || Math.abs(from.p.y - to.p.y) > 1)) {
      // A walk along the ground with a little bounce per step, shrinking or growing with depth as it goes.
      const steps = clamp(Math.round(Math.hypot(to.p.x - from.p.x, to.p.y - from.p.y) / 18), 3, 14)
      const frames: string[] = []
      for (let q = 0; q <= 20; q++) {
        const u = q / 20
        const t = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
        const sc = lerp(from.s, to.s, t)
        const bx = lerp(from.p.x, to.p.x, t)
        const by = lerp(from.p.y, to.p.y, t) - Math.abs(Math.sin(t * steps * Math.PI)) * 3 * sc
        frames.push(`${q * 5}%{transform:translate(${r1(bx)}px,${r1(by)}px) scale(${r1(sc * 100) / 100})}`)
      }
      styles.push(`@keyframes m${i}{${frames.join('')}}`)
      style = ` style="animation:m${i} ${MOVE_MS}ms linear ${-Math.round(elapsed)}ms both"`
    }
    const busy = pin.doing !== 'idle' && !pin.endedAt
    // Bubbles paint above every sprite, so they ride along in their own copy of the sprite's walk.
    const text = busy ? bubbleText(pin) : null
    if (text) {
      // Slid sideways to stay inside the picture; the tail still points at the agent.
      const dx = r1(clamp(W - 6 - (to.p.x + BUBBLE_L + text.w), 6 - (to.p.x + BUBBLE_L), 0))
      const lift = bubbleLift(to.p.x + dx, to.p.y - 24 * to.s - 12, text.w, placedBubbles)
      // Mid-walk, the bubble waits and pops up as the agent arrives, so a crowd setting off together doesn't drag a pile of bubbles along.
      const wait = style ? ` class="sbi" style="animation-delay:${Math.round(MOVE_MS - elapsed)}ms"` : ''
      bubbles.push({ lift, svg: `<g transform="translate(${r1(to.p.x)} ${r1(to.p.y)}) scale(${r1(to.s * 100) / 100})"><g${wait}>${bubble(text, to.s, lift, dx)}</g></g>` })
    }
    const what = pin.endedAt ? 'done' : [VERB[pin.doing], pin.detail].filter(Boolean).join(' ')
    // Wading in the lake: a ripple ring at the waterline, once the hop has landed.
    if (pin.spot.startsWith('l:') && !style) sprites.push(`<ellipse class="wr" cx="${r1(to.p.x)}" cy="${r1(to.p.y - 1)}" rx="${r1(15 * to.s)}" ry="${r1(4 * to.s)}"/>`)
    sprites.push(
      `<g transform="translate(${r1(to.p.x)} ${r1(to.p.y)}) scale(${r1(to.s * 100) / 100})"${style}${pin.endedAt ? ' opacity=".6"' : ''}><title>${xml(`${pin.label}: ${what}`)}</title>` +
        `<g${busy ? ' class="bob"' : ''}>${clawd(pin.role)}</g></g>`,
    )
  })

  const css =
    `.br{fill:none;stroke:#6e5038;stroke-linecap:round}` +
    `.lf{fill:#5f9a45}.v1 .lf{fill:#73a84f}.lw{fill:#d9822b}.lr{fill:#b4dd78}.bd{fill:#8c6c4a}` +
    `.cn{fill:#8cbf63;opacity:.38}.v1 .cn{fill:#9cc66b}.sh{fill:#000;opacity:.08}` +
    `.s0{stop-color:#cfe3f1}.s1{stop-color:#f3f1e6}.g0{stop-color:#a8c77e}.g1{stop-color:#7eab53}` +
    `.tr0{fill:#b9a27a;opacity:.55}.tr1{fill:#c9ad7f}.tr2{fill:#dcc79c;opacity:.8}.tr3{stroke:#8f8677;stroke-width:1.3;stroke-linecap:round}.tr4{fill:#a39c8e}.tr5{stroke:#5b8a3a;stroke-width:1;stroke-linecap:round;fill:none}` +
    `.sun{fill:#f6d488}.st{stroke:#fff;stroke-width:1.6;stroke-linecap:round;display:none}.cl{fill:#fff;opacity:.85;animation:cl linear infinite}` +
    `@keyframes cl{from{transform:translateX(-80px)}to{transform:translateX(${W + 80}px)}}` +
    `.gr{stroke:#5b8a3a;stroke-width:1;stroke-linecap:round;fill:none}` +
    `.cp{fill:#ebe6d4}.cpl{stroke:#cdbf9c;stroke-width:1.5}.cd{fill:#fbfaf6;stroke:#ddd3bb;stroke-width:1}` +
    `.tx{fill:#3f3f3f;font-family:${FONT}}.tm{fill:#8a8a8a;font-family:${FONT}}.rl{fill:#c15f3c;font-weight:600}.nm-away{opacity:.5}.wr{fill:#bfeeee;fill-opacity:.35;stroke:#eafcfb;stroke-width:1.2}.bu{fill:#5a8f40;opacity:.9}.b1{fill:#3f7029}.b2{fill:#4f8636}.b3{fill:#669d47}.by{fill:#d9822b}.bl{opacity:.85}.rk{fill:#b9b4a6}.fw{fill:#fff}.fy{fill:#f2d26b}.fp{fill:#e7a3b8}` +
    `.lb{paint-order:stroke;stroke:#e9f0dc;stroke-width:3px;stroke-linejoin:round}` +
    `.sb{fill:#fff;stroke:#1f1f1f;stroke-width:1.5;stroke-linejoin:round}.sbt{font:10px ui-monospace,Menlo,monospace;fill:#1f1f1f}.sbi{animation:sbi .35s ease-out both}@keyframes sbi{from{opacity:0}}` +
    `.cb{fill:#d97757}.ce{fill:#1f1f1f}.o-gold{fill:#e9b949}.o-khaki{fill:#c9a56b}.o-khaki2{fill:#b48e57}.o-band{fill:#6e4f33}` +
    `.o-dark{fill:#2e2e2e}.o-blue{fill:#3b6fb6}.o-paper{fill:#cfe2f3}.o-paper2{fill:#9fc0de}.o-lens{fill:#9fd6e3;opacity:.85}.o-red{fill:#c0392b}.o-suit{fill:#27344d}.o-shirt{fill:#f6f5ef}.o-tie{fill:#b8323a}.o-dum{fill:#f2c230}.o-dumj{fill:#3a3a3a}.o-tgt{fill:#f7e27a}.o-wood{fill:#b9874f}.o-p1{fill:#e74c3c}.o-p2{fill:#3498db}.o-p3{fill:#f1c40f}` +
    `@media (prefers-color-scheme: dark){.br{stroke:#9b7656}.lf{fill:#6fae52}.v1 .lf{fill:#82b85c}.cn{fill:#4f7d39;opacity:.45}.v1 .cn{fill:#5a8a40}` +
    `.sh{opacity:.3}.g0{stop-color:#253023}.g1{stop-color:#1c2619}` +
    `.tr0{fill:#2f2a20}.tr1{fill:#40382a}.tr2{fill:#4c4332}.tr3{stroke:#6d665a}.tr4{fill:#5a554c}.tr5{stroke:#4f7a3a}.cl{fill:#3b4350;opacity:.6}` +
    `.gr{stroke:#4f7a3a}.cp{fill:#24231f}.cpl{stroke:#3b372d}.cd{fill:#2c2b27;stroke:#45413a}.tx{fill:#dedad0}.tm{fill:#9a968c}.rl{fill:#e88d67}.lb{stroke:#232a20}.bu{fill:#3f6a30}.b1{fill:#2f5223}.b2{fill:#3a632b}.b3{fill:#4a7637}.rk{fill:#4a4842}.fw{fill:#cfcfcf}}` +
    `.bob{animation:bob .5s ease-in-out infinite alternate}@keyframes bob{to{transform:translateY(-3px)}}` +
    `.pu{animation:pu 1s ease-in-out 4}@keyframes pu{50%{opacity:.35}}` +
    `@media (prefers-reduced-motion: reduce){.bob,.pu,.cl{animation:none}}` +
    styles.join('')
  const sceneCss = css + CAMP_CSS + LIGHTING_CSS
  // Higher bubbles first, so a lower bubble paints over the long tail reaching past it.
  const bubbleMarkup = bubbles.sort((a, b) => b.lift - a.lift).map(b => b.svg).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="${tod.phase}" width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">` +
    `<style>${sceneCss}${TREE_CSS}${backdrop.CSS}${life ? wildlife.CSS : ''}</style><defs>${CAMP_DEFS}${TREE_DEFS}${backdrop.DEFS}${life ? wildlife.DEFS : ''}<path id="lf" d="M0 0Q4.5 -4 0 -10Q-4.5 -4 0 0Z"/>${clawdDefs(shown.map(p => p.role), 2.4)}` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset=".72" class="s2"/><stop offset="1" class="s1"/></linearGradient>` +
    `<radialGradient id="hgg"><stop offset="0" class="h0"/><stop offset="1" class="h0" stop-opacity="0"/></radialGradient><radialGradient id="fgg"><stop offset="0" class="fg0"/><stop offset="1" class="fg0" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></linearGradient></defs>` +
    `<g>${parts.slice(0, 2).join('')}${life ? wildlife.drawLayer('sky', life) + wildlife.drawLayer('slopes', life) : ''}${parts.slice(2, 7).join('')}${backdropSvg}${[...layers, ...(life ? wildlife.drawGround(life) : [])].sort((a, b) => a.y - b.y).map(l => l.svg).join('')}${campParts.join('')}` +
    `<rect class="tint" width="${W}" height="${H}"/><ellipse class="fg" cx="${r1(camp.fire.x)}" cy="${r1(camp.fire.y - 10)}" rx="${r1(camp.rx * 1.1)}" ry="${r1(camp.ry * 1.9)}" fill="url(#fgg)"/>${names.join('')}${sprites.join('')}${bubbleMarkup}</g></svg>`
  return { svg, height: H, seats, radio: camp.radio.p }
}

/** Draws the scene at W x H (H defaults to a landscape shape), shedding tooltips, leaves and depth until it fits the Svg budget. */
export function drawForest(f: Forest, pins: Pin[], touches: Record<string, Touch>, now: number, W: number, height = 0): Drawn | null {
  const H = Math.round(height > 0 ? Math.max(320, height) : clamp(W * 0.72, 420, 1400))
  // No needle tufts or aspen leaves for now (maxTufts 0): they read as clutter, and the speech bubbles name the file instead.
  const tries: Opts[] = [
    { titles: false, maxFiles: 36, maxDepth: 6, maxTufts: 0 },
    { titles: false, maxFiles: 12, maxDepth: 4, maxTufts: 0 },
    { titles: false, maxFiles: 4, maxDepth: 3, maxTufts: 0 },
    { titles: false, maxFiles: 0, maxDepth: 2, maxTufts: 0 },
    // Last resort for a huge repo: the animals go before the forest does.
    { titles: false, maxFiles: 0, maxDepth: 2, maxTufts: 0, wildlife: false },
  ]
  // A small repo is laid out on a smaller stage and scaled up to the pane, so trees, camp and agents all zoom in together.
  const zoom = sceneZoom(f.trees.filter(t => t.path !== '').length)
  const w = Math.round(W / zoom), h = Math.round(H / zoom)
  for (const o of tries) {
    const out = attempt(f, pins, touches, now, w, h, o)
    if (out.svg.length > SVG_BUDGET) continue
    // The svg scales itself to the pane, but the hover patches are placed in pane pixels.
    const up = (p: P) => ({ x: p.x * zoom, y: p.y * zoom })
    return { ...out, height: H, seats: Object.fromEntries(Object.entries(out.seats).map(([id, p]) => [id, up(p)])), radio: up(out.radio) }
  }
  return null
}

// Full zoom up to this many folders, none from ZOOM_UNTIL on, eased in between.
const ZOOM_MAX = 1.4
const ZOOM_FULL = 2
const ZOOM_UNTIL = 9

/** How far to zoom the whole scene in for a repo with this many top-level folders. */
export function sceneZoom(folders: number): number {
  return lerp(ZOOM_MAX, 1, clamp((folders - ZOOM_FULL) / (ZOOM_UNTIL - ZOOM_FULL), 0, 1))
}

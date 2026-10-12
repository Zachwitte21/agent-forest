/**
 * backdrop.ts
 * Unlabeled background forest that fills the scene around the repo's own trees; agents never visit it.
 */

export type P = { x: number; y: number }

export type Backdrop = {
  W: number
  H: number
  /** Where the sky meets the ground. */
  horizon: number
  /** Where the forest band ends and the open meadow begins. */
  meadowTop: number
  /** Ground y for depth z (0 = front of the forest band, 1 = the horizon). */
  groundAt: (z: number) => number
  /** Scale for depth z: about 1 at the front, 0.5 at the back. */
  depth: (z: number) => number
  /** The repo's real trees as placed: trunk foot, depth, half-width and height in px. Keep clear of these. */
  trees: Array<{ x: number; y: number; z: number; halfW: number; height: number }>
  /** Points along the trail with its width there; keep its corridor clear. */
  trail: Array<{ p: P; w: number }>
}

type Pt = [number, number]

const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function rng(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Relative moves after the first point keep every outline to short number pairs.
const rel = (p: Pt[]) => {
  let [x, y] = p[0].map(r0)
  const steps = p.slice(1).map(q => {
    const a = r0(q[0]), b = r0(q[1]), s = `${a - x} ${b - y}`
    x = a
    y = b
    return s
  })
  return `M${r0(p[0][0])} ${r0(p[0][1])}l${steps.join(' ')}Z`.replace(/ -/g, '-')
}

/** A conifer at unit height: foot at (0, 0), tiers of drooping skirts, the shaded left half a mirror of the lit right. */
function conifer(id: string, H: number, hw: number, tiers: number, low: number, trunk = ''): string {
  // Both halves reach a little past the middle so no hairline of grass shows down the seam.
  const half: Pt[] = [[-0.8, -H], [0, -H]]
  const step = (H - low) / tiers
  let prev = 0
  for (let i = 0; i < tiers; i++) {
    const yb = -H + step * (i + 1)
    const w = hw * Math.pow((i + 1) / tiers, 0.85)
    if (i) half.push([Math.max(prev * 0.5, 1), yb - step * 0.88])
    half.push([w, yb + step * 0.18])
    prev = w
  }
  half.push([0, -low], [-0.8, -low])
  return (
    `<g id="${id}">${trunk}<use href="#${id}h" transform="scale(-1 1)" fill="currentColor"/>` +
    `<path id="${id}h" d="${rel(half)}"/></g>`
  )
}

/** Three aspens, white trunks under golden crowns, the odd bright stand among the conifers. */
function aspens(id: string): string {
  const stand: Array<[number, number]> = [[-15, 58], [2, 72], [17, 52]]
  let trunks = '', crowns = '', lit = ''
  // Each crown is an ellipse traced as two arcs, so all three share one path instead of six tags.
  const oval = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`
  for (const [x, h] of stand) {
    trunks += `M${r1(x - 1.6)} 0l.8${r0(-h * 0.7)}h1.6l.8 ${r0(h * 0.7)}z`
    crowns += oval(x, r0(-h * 0.7), r0(h * 0.19), r0(h * 0.29))
    lit += oval(r0(x + h * 0.06), r0(-h * 0.74), r0(h * 0.11), r0(h * 0.2))
  }
  return `<g id="${id}"><path class="bk-w" d="${trunks}"/><path class="bk-y" d="${crowns}"/><path class="bk-z" d="${lit}"/></g>`
}

/** A shape in unit space: its height, half-width, markup, and the shapes its markup reuses. */
type Shape = { id: string; h: number; hw: number; svg: string; parts: Shape[] }

/** Several copies of smaller shapes on one footing, tallest drawn first so the shorter ones stand in front. */
function stand(id: string, seed: number, from: number, to: number, gap: number, lo: number, kinds: Shape[]): Shape {
  const R = rng(seed)
  const members: Array<{ x: number; k: number; kind: Shape }> = []
  for (let x = from; x <= to; x += gap * (0.75 + R() * 0.5)) members.push({ x: r0(x), k: Math.round((lo + R() * (1 - lo)) * 100) / 100, kind: kinds[Math.floor(R() * kinds.length)] })
  const k2 = (k: number) => String(k).replace(/^0/, '')
  const uses = members
    .sort((a, b) => b.k - a.k)
    .map(m => `<use href="#${m.kind.id}" transform="matrix(${k2(m.k)} 0 0 ${k2(m.k)} ${m.x} 0)"/>`)
  return {
    id,
    svg: `<g id="${id}">${uses.join('')}</g>`,
    h: Math.max(...members.map(m => m.k * m.kind.h)),
    hw: Math.max(...members.map(m => Math.abs(m.x) + m.k * m.kind.hw)),
    parts: [...new Set(kinds)],
  }
}

const SPRUCE: Shape = { id: 'bk-s', h: 100, hw: 30, svg: conifer('bk-s', 100, 30, 6, 6), parts: [] }
const FIR: Shape = { id: 'bk-f', h: 90, hw: 21, svg: conifer('bk-f', 90, 21, 6, 5), parts: [] }
// The lodgepole keeps its crown high on a long bare trunk, as the real ones do.
const PINE: Shape = { id: 'bk-p', h: 104, hw: 17, svg: conifer('bk-p', 104, 17, 4, 46, '<path class="bk-t" d="M-1.4 0V-48H1.4V0Z"/>'), parts: [] }
const ASPEN: Shape = { id: 'bk-a', h: 72, hw: 31, svg: aspens('bk-a'), parts: [] }
const GROVE = stand('bk-g', 7, -34, 34, 20, 0.6, [FIR, SPRUCE, FIR])
// A strip is a row of groves, so one tag near the horizon lays down a long stretch of treeline.
const STRIP = stand('bk-r', 1885, -130, 130, 50, 0.65, [GROVE])
/** Single trees and how often each is picked. */
const SINGLES: Array<[Shape, number]> = [[SPRUCE, 0.4], [FIR, 0.32], [PINE, 0.2], [ASPEN, 0.08]]

// The shapes travel with the markup instead, defined once each and only when used, so a crowded repo pays nothing for them.
export const DEFS = ''

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) =>
  '#' + hex(a).map((v, i) => r0(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('')
// Each row back mixes the real trees' greens a little further toward the air, the way distance pales a real treeline.
const HAZE = [0.1, 0.2, 0.3, 0.4]
const levels = (lit: string, shade: string, air: string) =>
  HAZE.map((t, i) => `.bk-${i}{fill:${mix(lit, air, t)};color:${mix(shade, air, t)}}`).join('')

export const CSS =
  levels('#3f7352', '#2c5540', '#b4cdd2') +
  `.bk-t{fill:#6a5546}.bk-w{fill:#e6e4dc}.bk-y{fill:#d6aa45}.bk-z{fill:#e9c25c}` +
  `@media (prefers-color-scheme: dark){${levels('#2c5741', '#1f3f31', '#2c3746')}` +
  `.bk-t{fill:#45362c}.bk-w{fill:#b9b6ac}.bk-y{fill:#a98431}.bk-z{fill:#b9963d}}`

type Row = { z: number; step: number; keep: number; grove: number }
// Dense near the horizon and sparse at the meadow edge, so the band reads as a treeline behind open parkland.
const ROWS: Row[] = [
  { z: 0.97, step: 0.8, keep: 1, grove: 0 },
  { z: 0.91, step: 0.85, keep: 0.95, grove: 0 },
  { z: 0.84, step: 0.95, keep: 0.9, grove: 0 },
  { z: 0.76, step: 0.85, keep: 0.9, grove: 0.65 },
  { z: 0.66, step: 1, keep: 0.8, grove: 0.5 },
  { z: 0.55, step: 1.25, keep: 0.7, grove: 0.4 },
  { z: 0.43, step: 1.6, keep: 0.55, grove: 0.3 },
  { z: 0.3, step: 2.1, keep: 0.45, grove: 0.2 },
  { z: 0.17, step: 2.6, keep: 0.4, grove: 0.15 },
  { z: 0.05, step: 3.1, keep: 0.35, grove: 0.1 },
]

/** Markup for the background forest, painted behind the repo's trees. */
export function draw(b: Backdrop): string {
  const { W, trees, trail } = b
  const band = b.meadowTop - b.horizon
  // A few real trees leave room for a full forest; fifteen leave only the picture's edges.
  const fill = clamp(1.25 - trees.length / 12, 0.1, 1)
  const out: string[] = []
  const used = new Set<Shape>()

  /** True if a tree of half-width hw and height h at (x, y) would touch a real tree, its label, or the trail. */
  const blocked = (x: number, y: number, hw: number, h: number, profile: number[]) => {
    for (const [k, f] of profile.entries()) {
      const Y = y - h * [0.05, 0.45, 0.85][k]
      const bw = hw * f
      for (const t of trees) {
        if (Y < t.y - t.height - 6) continue
        // The ground just below the trunk stays clear too, so the folder's name stays readable.
        const label = Y > t.y && Y < t.y + 24
        if (Y > t.y && !label) continue
        const u = (t.y - Y) / t.height
        const tw = label ? Math.max(t.halfW * 0.6, 48) : t.halfW * clamp(1.15 - u, 0.3, 1)
        if (Math.abs(x - t.x) < tw + bw + 6 + t.halfW * 0.12) return true
      }
    }
    for (const q of trail) {
      if (q.p.y < y - h || q.p.y > y + 3) continue
      const f = profile[q.p.y > y - h * 0.3 ? 0 : q.p.y > y - h * 0.65 ? 1 : 2]
      if (Math.abs(x - q.p.x) < q.w / 2 + hw * f + 6) return true
    }
    return false
  }
  /** True if a real tree nearby is not clearly taller, so the backdrop never upstages it. */
  const upstages = (x: number, z: number, h: number) =>
    trees.some(t => Math.abs(x - t.x) < t.halfW * 2 + 160 && h > 0.6 * t.height * (b.depth(z) / b.depth(t.z)))

  ROWS.forEach((row, ri) => {
    const R = rng(4441 + ri * 977)
    const s = Math.round(band * lerp(0.42, 0.11, Math.pow(row.z, 0.8))) / 100
    const gy = b.groundAt(row.z)
    const gap = Math.abs(b.groundAt(row.z) - b.groundAt(row.z - 0.08))
    const uses: Array<{ y: number; tag: string }> = []
    /** Places the shape at x if it clears everything, and says whether it did. */
    const place = (shape: Shape, x: number, dy: number) => {
      const profile = shape === STRIP ? [1, 0.85, 0.5] : [1, 0.6, 0.2]
      if (upstages(x, row.z, shape.h * s) || blocked(x, gy + dy, shape.hw * s, shape.h * s, profile)) return false
      const yu = r0(dy / s)
      used.add(shape)
      uses.push({ y: dy, tag: `<use href="#${shape.id}" x="${r0(x / s)}"${yu ? ` y="${yu}"` : ''}/>` })
      return true
    }
    for (let x = -R() * 40 * s; x < W + 30 * s; ) {
      // Every slot draws the same numbers whether or not it is kept, so one blocked slot never reshuffles the rest.
      const keep = R(), pick = R(), jit = R(), next = R()
      const edge = x < W * 0.1 || x > W * 0.9
      let shape: Shape = row.z > 0.72 ? STRIP : GROVE
      if (row.z <= 0.72 && pick >= row.grove) {
        let acc = (pick - row.grove) / (1 - row.grove)
        shape = SINGLES.find(([, odds]) => (acc -= odds) < 0)?.[0] ?? SPRUCE
      }
      // Strips are ragged enough already, so only the nearer rows spend characters on a stagger.
      const dy = row.z > 0.72 ? 0 : (jit - 0.5) * gap * 0.8
      // Slow waves along the row bunch the trees into stands with clearings between, as a real forest grows.
      const clump = 0.75 + 0.35 * Math.sin(x / W * 9 + ri * 2.3) + 0.2 * Math.sin(x / W * 23 + ri)
      // Far strips are small and cheap, so even a crowded repo keeps some treeline in the gaps between its trees.
      const odds = row.keep * clump * Math.max(fill, edge ? 0.7 : row.z > 0.8 ? 0.85 : row.z > 0.72 ? 0.5 : 0)
      // A strip that would touch a real tree breaks into groves, then single firs, so the treeline runs right up to it.
      if (keep < odds && !place(shape, x, dy) && shape === STRIP)
        for (const k of [-1, 0, 1]) {
          const gx = x + k * GROVE.hw * 1.8 * s
          if (!place(GROVE, gx, dy)) for (const f of [-0.5, 0.5]) place(FIR, gx + f * GROVE.hw * s, dy)
        }
      x += shape.hw * 2 * s * row.step * (0.75 + next * 0.5)
    }
    if (!uses.length) return
    const haze = row.z > 0.8 ? 3 : row.z > 0.6 ? 2 : row.z > 0.35 ? 1 : 0
    out.push(`<g class="bk-${haze}" transform="translate(0 ${r1(gy)})scale(${String(s).replace(/^0/, '')})">${uses.sort((p, q) => p.y - q.y).map(u => u.tag).join('')}</g>`)
  })
  if (!out.length) return ''
  for (const shape of used) shape.parts.forEach(p => used.add(p))
  return `<defs>${[...used].map(p => p.svg).join('')}</defs>${out.join('')}`
}

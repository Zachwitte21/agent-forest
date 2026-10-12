const f = (n: number) => Math.round(n * 10) / 10

type P = [number, number]

export const CSS = `.mt-fl{fill:#c4cbd4}.mt-fs{fill:#99a4b3}.mt-nl{fill:#a0a7a6}.mt-ns{fill:#757f86}.mt-sn{fill:#fbfdff}.mt-ss{fill:#c9d7e6}.mt-st{fill:none;stroke:#5f6b7a;stroke-width:1;opacity:.3;stroke-linecap:round}.mt-sl{fill:none;stroke:#f4f8fc;stroke-width:1.4;opacity:.85;stroke-linecap:round}.mt-hz{fill:url(#mt-h)}.mt-h0{stop-color:#e6f0f6;stop-opacity:0}.mt-h1{stop-color:#e6f0f6;stop-opacity:.55}.mt-tr{fill:#2d5953}
@media (prefers-color-scheme: dark){.mt-fl{fill:#4b5466}.mt-fs{fill:#353d4e}.mt-nl{fill:#363d4a}.mt-ns{fill:#262b34}.mt-sn{fill:#c6d1e0}.mt-ss{fill:#8b9ab0}.mt-st{stroke:#1a1f29;opacity:.45}.mt-sl{stroke:#aab7c9;opacity:.6}.mt-h0,.mt-h1{stop-color:#2a3446}.mt-h1{stop-opacity:.4}.mt-tr{fill:#14302d}}`

export const DEFS = `<linearGradient id="mt-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mt-h0"/><stop offset="1" class="mt-h1"/></linearGradient>`

// Seeded so every render of the scene gets the exact same skyline.
const rng = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
// Relative moves after the first point roughly halve the digits, which is what keeps this under budget.
const rel = (p: P[]) => {
  const m = `M${f(p[0][0])} ${f(p[0][1])}l`
  let x = f(p[0][0]), y = f(p[0][1])
  const o = p.slice(1).map((q) => { const a = f(q[0]), b = f(q[1]), s = `${f(a - x)} ${f(b - y)}`; x = a; y = b; return s })
  return (m + o.join(' ')).replace(/ -/g, '-')
}
const poly = (p: P[]) => rel(p) + 'Z'
const line = (a: P, b: P) => rel([a, b])

/** Chain points above y, plus the point where the chain crosses y. */
const cut = (c: P[], y: number): P[] => {
  const o: P[] = [c[0]]
  for (let i = 1; i < c.length; i++) {
    if (c[i][1] >= y) return o.concat([lerp(c[i - 1], c[i], (y - c[i - 1][1]) / (c[i][1] - c[i - 1][1] || 1))])
    o.push(c[i])
  }
  return o
}
const xAt = (c: P[], y: number) => cut(c, y).pop()![0]

/** One mountain range: lit silhouette, shaded right faces, strata, and snow on peaks taller than snowAt. */
function range(R: () => number, W: number, hz: number, H: number, sp: number, lo: number, hi: number, top: number, snowAt: number, dip: number) {
  const n = Math.ceil(W / sp) + 1
  const s = W / (n - 1)
  const pk = Array.from({ length: n }, (_, i): [number, number] => [(i + (R() - 0.5) * 0.45) * s, lo + (hi - lo) * R()])
  let m = 1
  pk.forEach((p, i) => { if (p[0] > W * 0.15 && p[0] < W * 0.85 && p[1] > pk[m][1]) m = i })
  pk[m][1] = top
  const A = pk.map((p): P => [p[0], hz - p[1] * H])
  const V: P[] = [[A[0][0] - s * 0.6, hz - pk[0][1] * H * 0.3]]
  for (let i = 0; i < n - 1; i++) V.push([A[i][0] + (A[i + 1][0] - A[i][0]) * (0.4 + 0.2 * R()), hz - Math.min(pk[i][1], pk[i + 1][1]) * H * (dip + 0.2 * R())])
  V.push([A[n - 1][0] + s * 0.6, hz - pk[n - 1][1] * H * 0.3])
  // Two kinks per side give the stepped, broken ridgelines of Rockies limestone instead of clean cones.
  const sh = (a: P, v: P): P[] => [0.22 + 0.1 * R(), 0.55 + 0.15 * R()].map((t): P => { const q = lerp(a, v, t); return [q[0], q[1] + (R() - 0.45) * 0.1 * H] })

  const sil: P[] = [[V[0][0], hz], V[0]]
  let shade = '', st = '', sl = '', sn = '', ss = ''
  A.forEach((a, i) => {
    const L = [a, ...sh(a, V[i]), V[i]], Rt = [a, ...sh(a, V[i + 1]), V[i + 1]]
    sil.push(L[2], L[1], a, Rt[1], Rt[2], V[i + 1])
    const B: P = [a[0] + 0.2 * (V[i + 1][0] - a[0]), hz]
    const r1 = lerp(a, B, 0.45)
    const ridge: P[] = [a, [r1[0] - (R() - 0.3) * 0.12 * (V[i + 1][0] - a[0]), r1[1]], B]
    shade += poly([...Rt, [V[i + 1][0], hz], B, ridge[1]])
    const bl = L.concat([[V[i][0], hz]]), br = Rt.concat([[V[i + 1][0], hz]])
    const drop = Math.min(V[i][1], V[i + 1][1]) - a[1]
    // Strata tilt up to the right, the way Rundle-style limestone slabs dip.
    const strat = (y0: number, k: number) => {
      const x0 = xAt(bl, y0), w = xAt(br, y0) - x0
      const x1 = x0 + w * (0.1 + 0.3 * R()), ln = w * (0.25 + 0.3 * R()), y2 = y0 - ln * 0.35
      return w > 8 && y2 > a[1] + 4 && x1 + ln < xAt(br, y2) - 2 && x1 + ln > xAt(bl, y2) + 2 ? line([x1, y0], [x1 + ln, y2]) : ''
    }
    for (let k = 0; k < 3; k++) st += strat(a[1] + (hz - a[1]) * (0.3 + 0.5 * R()), k)
    if (pk[i][1] < snowAt) return
    const ys = a[1] + drop * (pk[i][1] - snowAt + 0.25 + 0.12 * R()), d = drop * 0.1 * (0.7 + R())
    const xl = xAt(L, ys), xr = xAt(Rt, ys), rx = Math.min(xAt(ridge, ys), xr - 2)
    const z: P[] = [1, 2, 3].map((j): P => [xl + (xr - xl) * (j / 4 + (R() - 0.5) * 0.1), ys + (j % 2 ? d : -d * 0.3)])
    sn += poly(cut(L, ys).concat(z, cut(Rt, ys).reverse().slice(0, -1)))
    ss += poly(cut(Rt, ys).concat([[(rx + xr) / 2, ys + d * 0.7], [rx, ys]], cut(ridge, ys).slice(1, -1).reverse()))
    sl += strat(ys + drop * 0.35, 0)
  })
  sil.push([V[n][0], hz])
  return { sil: poly(sil), shade, st, sl, sn, ss }
}

/** Banff-style backdrop: far snowy limestone peaks, haze, a darker near range, then a conifer treeline at the horizon. */
export function draw(W: number, horizon: number, top: number): string {
  const H = horizon - top, R = rng(1885)
  const p = (c: string, d: string) => (d ? `<path class="mt-${c}" d="${d}"/>` : '')
  const g = (r: ReturnType<typeof range>, l: string, s: string) => p(l, r.sil) + p(s, r.shade) + p('st', r.st) + p('sn', r.sn) + p('ss', r.ss) + p('sl', r.sl)
  const far = range(R, W, horizon, H, H * 0.85, 0.42, 0.64, 0.75, 0.5, 0.45)
  const near = range(R, W, horizon, H, H * 0.55, 0.16, 0.32, 0.4, 0.38, 0.5)

  // Relative moves keep ~1 spire per 8px affordable inside the size budget.
  const t: P[] = [[0, horizon]]
  for (let x = 0; x < W; ) {
    const w = 6 + 4 * R()
    t.push([x + w / 2, horizon - 3 - H * (0.035 + 0.05 * R() * R())], [x + w, horizon - 1 - 2 * R()])
    x += w
  }
  const tree = `${rel(t)}V${f(horizon + 1)}H0Z`

  return g(far, 'fl', 'fs') + `<rect class="mt-hz" x="0" y="${f(horizon - H * 0.3)}" width="${W}" height="${f(H * 0.3)}"/>` + g(near, 'nl', 'ns') + p('tr', tree)
}

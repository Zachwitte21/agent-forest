const f = (n: number) => Math.round(n * 10) / 10

// Glacial turquoise, like Moraine Lake: deep teal at the back, milky shallows at the front.
export const CSS = `.la-sa{fill:#e6d6a6}.la-we{fill:#b7a276}.la-w0{fill:url(#la-w)}.la-s1{stop-color:#11788a}.la-s2{stop-color:#2bb3bf}.la-s3{stop-color:#8fe0dc}.la-hi{fill:#fff;opacity:.3}.la-r{fill:none;stroke:#fff;stroke-width:1;transform-box:fill-box;transform-origin:center;animation:la-rp 6s linear infinite}.la-g{stroke:#fff;stroke-width:1.4;stroke-linecap:round;animation:la-gl 4s ease-in-out infinite}@keyframes la-rp{0%{transform:scale(.2);opacity:.8}100%{transform:scale(1.5);opacity:0}}@keyframes la-gl{0%,100%{opacity:0}50%{opacity:.9}}.la-lp{fill:#5e9a4a;stroke:#3d7032;stroke-width:.6}.la-fl{fill:#f5b3c6}.la-fc{fill:#f6d35a}.la-st{fill:none;stroke:#5c8a3a;stroke-width:1.6;stroke-linecap:round}.la-ch{stroke:#7a4d28;stroke-width:3.2;stroke-linecap:round}.la-dp{stroke:#4f331d;stroke-width:2.6}.la-ds{fill:#77502f}.la-dd{fill:#bf8f5b}.la-dl{stroke:#8c6340;stroke-width:.8}.la-rk{fill:#94948c}.la-rh{fill:#c6c5ba}.la-pb{stroke:#a69c84;stroke-width:1.8;stroke-linecap:round}
@media (prefers-color-scheme: dark){.la-sa{fill:#4f4a38}.la-we{fill:#39342a}.la-s1{stop-color:#063a44}.la-s2{stop-color:#0f5f68}.la-s3{stop-color:#2a8580}.la-hi{opacity:.1}.la-r{stroke:#8fa9cf}.la-g{stroke:#c9dbff;opacity:.5}.la-lp{fill:#2f5229;stroke:#22401e}.la-fl{fill:#b98597}.la-fc{fill:#bfa548}.la-st{stroke:#3f5e2a}.la-ch{stroke:#4f341d}.la-dp{stroke:#2e1f12}.la-ds{fill:#45301d}.la-dd{fill:#6e5338}.la-dl{stroke:#52391f}.la-rk{fill:#555650}.la-rh{fill:#73746b}.la-pb{stroke:#625c4c}}
@media (prefers-reduced-motion: reduce){.la-r,.la-g{animation:none;opacity:.4}}`

export const DEFS = `<linearGradient id="la-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="la-s1"/><stop offset=".6" class="la-s2"/><stop offset="1" class="la-s3"/></linearGradient>`

/** Shared wobble keeps sand, wet edge and water roughly concentric but not a perfect ellipse. */
const pt = (a: number, sx: number, sy: number) => {
  const w = 1 + 0.04 * Math.sin(3 * a + 0.9) + 0.03 * Math.cos(5 * a)
  return [Math.cos(a) * sx * w, Math.sin(a) * sy * w]
}

const shore = (sx: number, sy: number) => {
  const p = Array.from({ length: 12 }, (_, i) => pt((i * Math.PI) / 6, sx, sy))
  const m = (a: number[], b: number[]) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`
  return `M${m(p[11], p[0])}` + p.map((q, i) => `Q${f(q[0])} ${f(q[1])} ${m(q, p[(i + 1) % 12])}`).join('') + 'Z'
}

const pad = (x: number, y: number, s: number) =>
  `<path class="la-lp" d="M${f(x)} ${f(y)}L${f(x + s)} ${f(y - s * 0.12)}A${f(s)} ${f(s * 0.5)} 0 1 0 ${f(x + s)} ${f(y + s * 0.12)}Z"/>`

/** One cattail clump; lean tips it and its loose leaf away from the water. */
const reeds = (x: number, y: number, h: number, lean: number) => {
  let st = '', hd = ''
  for (const i of [-1, 0, 1, 2]) {
    const bx = x + i * 3.5, tx = bx + i * 2.5 + lean, ty = y - h * (1 - 0.15 * Math.abs(i))
    st += `M${f(bx)} ${f(y)}Q${f(bx)} ${f((y + ty) / 2)} ${f(tx)} ${f(ty)}`
    if (i < 2) hd += `M${f(tx)} ${f(ty + h * 0.1)}l0 ${f(h * 0.18)}`
  }
  st += `M${f(x - 4)} ${f(y)}q${f(-lean * 6)} ${f(-h * 0.3)} ${f(-lean * 9)} ${f(-h * 0.45)}`
  return `<path class="la-st" d="${st}"/><path class="la-ch" d="${hd}"/>`
}

const rock = (x: number, y: number, s: number) =>
  `<ellipse class="la-rk" cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.6)}"/><ellipse class="la-rh" cx="${f(x - s * 0.2)}" cy="${f(y - s * 0.25)}" rx="${f(s * 0.5)}" ry="${f(s * 0.22)}"/>`

/**
 * draw(rx, ry, now)
 * The lake in local coordinates: beach, water, ripples, lily pads, reeds, rocks and a dock.
 */
export function draw(rx: number, ry: number, now: number): string {
  const t = now / 1000
  const d = (n: number, p: number) => `style="animation-delay:${f(-((t + p) % n))}s"`

  let pb = ''
  for (let i = 0; i < 9; i++) {
    const [x, y] = pt(i * 0.7 + 0.3, rx * 1.1, ry * 1.13)
    pb += `M${f(x)} ${f(y)}h0`
  }

  let rp = ''
  for (const [x, y, p] of [[-0.25, -0.15, 0], [0.4, 0.15, 2], [-0.05, 0.45, 4]]) {
    rp += `<ellipse class="la-r" ${d(6, p)} cx="${f(rx * x)}" cy="${f(ry * y)}" rx="${f(rx * 0.14)}" ry="${f(ry * 0.12)}"/>`
  }

  let gl = ''
  for (const [x, y, p] of [[-0.55, -0.4, 0], [0.2, -0.55, 1.3], [0.6, 0.35, 2.6]]) {
    gl += `<path class="la-g" ${d(4, p)} d="M${f(rx * x)} ${f(ry * y)}h${f(rx * 0.07)}"/>`
  }

  // Dock sits right of centre so the front stump has a clear spot on the beach.
  const dx = rx * 0.2, w = rx * 0.09, y0 = ry * 0.22, y1 = ry * 1.12
  const deck = (o: number) => `M${f(dx - w)} ${f(y1 + o)}H${f(dx + w)}L${f(dx + w * 0.8)} ${f(y0 + o)}H${f(dx - w * 0.8)}Z`
  let pl = ''
  for (let i = 1; i < 7; i++) {
    const y = y0 + ((y1 - y0) * i) / 7
    pl += `M${f(dx - w)} ${f(y)}H${f(dx + w)}`
  }
  const posts = `M${f(dx - w * 0.75)} ${f(y0)}v${f(ry * 0.14)}M${f(dx + w * 0.75)} ${f(y0)}v${f(ry * 0.14)}M${f(dx - w * 0.9)} ${f(ry * 0.65)}v${f(ry * 0.14)}M${f(dx + w * 0.9)} ${f(ry * 0.65)}v${f(ry * 0.14)}`

  const fx = -rx * 0.48, fy = ry * 0.05, fs = rx * 0.12

  return [
    `<path class="la-sa" d="${shore(rx * 1.16, ry * 1.2)}"/>`,
    `<path class="la-pb" d="${pb}"/>`,
    `<path class="la-we" d="${shore(rx * 1.04, ry * 1.06)}"/>`,
    `<path class="la-w0" d="${shore(rx, ry)}"/>`,
    `<ellipse class="la-hi" cx="${f(-rx * 0.1)}" cy="${f(-ry * 0.42)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.1)}"/>`,
    rp,
    gl,
    pad(fx, fy, fs),
    pad(-rx * 0.28, ry * 0.42, rx * 0.09),
    pad(rx * 0.5, -ry * 0.3, rx * 0.1),
    `<ellipse class="la-fl" cx="${f(fx + fs * 0.1)}" cy="${f(fy - fs * 0.2)}" rx="${f(fs * 0.38)}" ry="${f(fs * 0.25)}"/><ellipse class="la-fl" cx="${f(fx + fs * 0.1)}" cy="${f(fy - fs * 0.4)}" rx="${f(fs * 0.2)}" ry="${f(fs * 0.22)}"/><circle class="la-fc" cx="${f(fx + fs * 0.1)}" cy="${f(fy - fs * 0.28)}" r="${f(fs * 0.11)}"/>`,
    rock(-rx * 0.48, ry * 1.02, rx * 0.08),
    rock(rx * 1.0, ry * 0.45, rx * 0.065),
    rock(-rx * 0.35, -ry * 1.08, rx * 0.07),
    `<path class="la-dp" d="${posts}"/>`,
    `<path class="la-ds" d="${deck(2)}"/>`,
    `<path class="la-dd" d="${deck(0)}"/>`,
    `<path class="la-dl" d="${pl}"/>`,
    reeds(-rx * 0.97, -ry * 0.12, ry * 0.6, -1),
    reeds(rx * 0.92, -ry * 0.32, ry * 0.55, 1),
  ].join('')
}

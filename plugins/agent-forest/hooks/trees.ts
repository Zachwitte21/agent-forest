import type { FNode, Touch } from '../types'

type P = { x: number; y: number }
export type Species = 'spruce' | 'fir' | 'pine' | 'aspen'
export type TreeArt = { svg: string; nodes: Map<string, P>; minX: number; maxX: number; height: number; species: Species }
// scale is how big draw.ts will show the tree, so a big aspen can stay slender instead of swelling into a lollipop.
type Opts = { now: number; touches: Record<string, Touch>; maxTufts: number; scale?: number }

const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const READ_GLOW_MS = 4000

function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), h | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const filesOf = (n: FNode) => (n.children ?? []).filter(c => c.kind === 'file')
const dirsOf = (n: FNode) => (n.children ?? []).filter(c => c.kind === 'dir')
const allFiles = (n: FNode): FNode[] => [...filesOf(n), ...dirsOf(n).flatMap(allFiles)]
const allDirs = (n: FNode): FNode[] => dirsOf(n).flatMap(d => [d, ...allDirs(d)])

/** A folder holding nothing but one folder folds into it, so the tree isn't built around an empty wrapper. */
function unwrap(node: FNode): { node: FNode; aliases: string[] } {
  const aliases = [node.path]
  for (;;) {
    const only = node.children?.length === 1 ? node.children[0] : null
    if (!only || only.kind !== 'dir' || !only.children?.length) break
    node = only
    aliases.push(node.path)
  }
  return { node, aliases }
}

/**
 * Banff's trees, picked by the folder's shape: small folders are golden aspens, a folder that is mostly one or two deep
 * subfolders is a lodgepole pine (tall bare trunk, crown on top), big folders are Engelmann spruce, the rest subalpine fir.
 */
export function speciesOf(tree: FNode): Species {
  const { node } = unwrap(tree)
  const total = allFiles(node).length
  const tiers = dirsOf(node).length
  if (total <= 6) return 'aspen'
  if (tiers <= 2 && total >= 12 && filesOf(node).length <= 4) return 'pine'
  if (total >= 40) return 'spruce'
  return 'fir'
}

/** A file's tuft of needles (or an aspen leaf): orange once edited, pulsing while read. */
function tuft(path: string, at: P, rot: number, o: Opts, kind: 'nd' | 'al'): string {
  const t = o.touches[path]
  const age = t ? o.now - t.at : Infinity
  const cls = t?.kind === 'write' ? `${kind}w` : `${kind}`
  const use = `<use href="#${kind}" class="${cls}" transform="translate(${r1(at.x)} ${r1(at.y)}) rotate(${Math.round(rot)})"/>`
  return age < READ_GLOW_MS ? `<g class="pu" style="animation-delay:-${Math.round(age)}ms">${use}</g>` : use
}

type Tier = { paths: string[]; files: FNode[]; weight: number }

/** One tree in local coordinates: base of the trunk at (0, 0), up is negative y. */
export function drawTree(tree: FNode, o: Opts): TreeArt {
  const { node, aliases } = unwrap(tree)
  const rnd = seeded(tree.path || '.')
  const species = speciesOf(tree)
  const files = allFiles(node)
  const total = Math.max(1, files.length)
  const nodes = new Map<string, P>()
  const out: string[] = []
  // Each subfolder is one tier of branches; the folder's own files crown the top.
  const tiers: Tier[] = dirsOf(node)
    .map(d => ({ paths: [d.path, ...allDirs(d).map(x => x.path)], files: allFiles(d), weight: allFiles(d).length + 1 }))
    .sort((a, b) => b.weight - a.weight)
  const own = filesOf(node)
  let budget = o.maxTufts

  if (species === 'aspen') {
    const H = clamp(48 + 9 * Math.sqrt(total), 48, 90)
    const R = H * 0.2
    const cx = (rnd() - 0.5) * 4
    // Shown big, the trunk thins and the crown narrows into a tall oval, as a real aspen's does; at forest size nothing changes.
    const big = clamp(((o.scale ?? 1) - 2.5) / 2.5, 0, 1)
    const trunk = 1 - 0.55 * big, sx = 1 - 0.45 * big, sy = 1 + 0.6 * big, blob = 1 - 0.2 * big
    // The crown's centre drops just enough that its top stays inside the height draw.ts fits the tree to.
    const cy = -(H * 0.78 - R * Math.max(0, 0.6 * sy + 0.87 * blob - 1.47))
    out.push(`<ellipse class="tsh" cx="0" cy="1" rx="${r1(R * 1.1 * sx)}" ry="3"/>`)
    out.push(`<path class="awt" d="M${r1(-2.2 * trunk)} 0L${r1(cx - 1.4 * trunk)} ${r1(-H * 0.72)}H${r1(cx + 1.4 * trunk)}L${r1(2.2 * trunk)} 0Z"/>`)
    out.push(`<path class="awm" d="M${r1(-1.6 * trunk)} ${r1(-H * 0.2)}h${r1(2.4 * trunk)}M${r1(-1.2 * trunk)} ${r1(-H * 0.38)}h${r1(2 * trunk)}M${r1(-0.8 * trunk)} ${r1(-H * 0.55)}h${r1(1.8 * trunk)}"/>`)
    const blobs: P[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.6
      blobs.push({ x: cx + Math.cos(a) * R * 0.75 * sx, y: cy + Math.sin(a) * R * 0.6 * sy })
    }
    blobs.forEach((b, i) => out.push(`<circle class="ac${i % 3}" cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(R * (0.62 + rnd() * 0.25) * blob)}"/>`))
    // A tall oval has a hollow down its middle that the ring of blobs leaves open; two more fill it.
    if (big > 0) for (const [dy, c] of [[-0.3, 1], [0.3, 2]]) out.push(`<circle class="ac${c}" cx="${r1(cx)}" cy="${r1(cy + dy * R * sy)}" r="${r1(R * 0.7 * blob)}"/>`)
    const crown = { x: cx, y: cy - H * 0.02 }
    for (const p of [...aliases, ...allDirs(node).map(d => d.path)]) nodes.set(p, crown)
    files.forEach((f, i) => {
      const a = (i / files.length) * Math.PI * 2 + rnd() * 0.3
      const at = { x: cx + Math.cos(a) * R * 1.15 * sx, y: cy + Math.sin(a) * R * 0.95 * sy }
      nodes.set(f.path, at)
      if (budget-- > 0) out.push(tuft(f.path, at, (a * 180) / Math.PI + 90, o, 'al'))
    })
    const reach = R * (0.75 * sx + 0.87 * blob + 0.28)
    return { svg: out.join(''), nodes, minX: -reach, maxX: reach, height: H + R * 0.3, species }
  }

  // A lodgepole stands about as tall as a fir with the same files; its long bare trunk gives it the character, not extra height.
  const H = clamp(52 + 15 * Math.sqrt(total), 56, 300) * (species === 'pine' ? 0.96 : 1)
  const base = species === 'spruce' ? 0.4 : species === 'fir' ? 0.27 : 0.17
  const halfW = H * base * (0.92 + rnd() * 0.16)
  const trunkW = clamp(2.2 + Math.sqrt(total) * 0.42, 2.5, 9)
  // Where the foliage starts and stops: a pine keeps its branches high on a long bare trunk.
  const crownLow = species === 'pine' ? H * 0.58 : H * 0.12
  const crownH = H - crownLow
  const count = Math.max(species === 'pine' ? 3 : 4, tiers.length + 1)
  const maxW = Math.max(1, ...tiers.map(t => t.weight))

  out.push(`<ellipse class="tsh" cx="0" cy="1" rx="${r1(halfW * (species === 'pine' ? 1.6 : 0.9))}" ry="3.2"/>`)
  out.push(`<path class="${species === 'pine' ? 'ptk' : 'ctk'}" d="M${r1(-trunkW / 2)} 0L${r1(-trunkW * 0.3)} ${r1(-H * 0.9)}H${r1(trunkW * 0.3)}L${r1(trunkW / 2)} 0Z"/>`)
  if (species === 'pine') {
    // Stubs of old branches on the bare trunk, the lodgepole's giveaway.
    let d = ''
    for (let i = 0; i < 4; i++) {
      const y = -crownLow * (0.35 + i * 0.16)
      const side = i % 2 ? 1 : -1
      d += `M0 ${r1(y)}l${r1(side * (5 + rnd() * 4))} ${r1(-2 - rnd() * 2)}`
    }
    out.push(`<path class="pst" d="${d}"/>`)
  }

  const dark = species === 'spruce' ? 'sp' : species === 'fir' ? 'fr' : 'pn'
  for (let i = 0; i < count; i++) {
    // Tier 0 is the lowest and widest; the heaviest subfolders sit lowest, as a real tree's oldest limbs do.
    const tier = i < tiers.length ? tiers[i] : null
    const u = i / count
    const yb = -(crownLow + crownH * u * 0.92)
    const th = (crownH / count) * (species === 'fir' ? 1.75 : 1.55)
    const taper = Math.pow(1 - u, species === 'fir' ? 0.95 : 0.8)
    const hw = halfW * taper * (tier ? 0.88 + 0.24 * Math.sqrt(tier.weight / maxW) : 0.9) * (0.92 + rnd() * 0.16)
    const apex = yb - th
    const droop = th * (species === 'spruce' ? 0.16 : 0.1)
    const yc = yb + droop * 0.4
    // The top tier draws the tree's own top in one outline, so no separate cap can leave a ledge, gap or seam.
    let top = apex
    let down = ''
    let up = ''
    if (i === count - 1 && species === 'pine') {
      // The lodgepole's rounded tuft: the cone's last stretch bends into a dome.
      const ys = apex + (yc - apex) * 0.3
      const w = (hw * (ys - apex)) / (yc - apex)
      top = Math.max(ys - w * 1.4, -H - 10)
      const mid = ys - (ys - top) * 0.5
      down = `C${r1(w * 0.7)} ${r1(top)} ${r1(w * 1.1)} ${r1(mid)} ${r1(w)} ${r1(ys)}`
      up = `L${r1(-w)} ${r1(ys)}C${r1(-w * 1.1)} ${r1(mid)} ${r1(-w * 0.7)} ${r1(top)} 0 ${r1(top)}`
    } else if (i === count - 1) {
      // A narrow spire rising out of the cone; it never tops the height draw.ts fits the tree to.
      top = species === 'fir' ? -H - 10 : clamp(apex - H * 0.03, -H - 10, -H - 5)
      const cone = Math.min(apex, top)
      const ys = top + Math.min(H * (species === 'fir' ? 0.09 : 0.065), (yc - top) * 0.45)
      const sp = (hw * (ys - cone)) / (yc - cone) * 0.55
      down = `L${r1(sp)} ${r1(ys)}`
      up = `L${r1(-sp)} ${r1(ys)}`
    }
    // The skirt: apex down to two drooping tips, with a scalloped hem between them.
    let hem = ''
    // A handful of scallops reads as a drooping hem; more only costs size in a forest of fifteen big trees.
    const scallops = clamp(Math.round(hw / 10), 2, 6)
    for (let k = scallops - 1; k >= 0; k--) {
      const x0 = -hw + (2 * hw * (k + 1)) / scallops
      const x1 = -hw + (2 * hw * k) / scallops
      hem += `Q${r1((x0 + x1) / 2)} ${r1(yb - droop)} ${r1(x1)} ${r1(yb + (k === 0 ? droop * 0.4 : 0))}`
    }
    out.push(`<path class="${dark}0" d="M0 ${r1(top)}${down}L${r1(hw)} ${r1(yc)}${hem}${up}Z"/>`)
    out.push(`<path class="${dark}1" d="M0 ${r1(top)}${down}L${r1(hw)} ${r1(yc)}Q${r1(hw * 0.5)} ${r1(yb - droop)} 0 ${r1(yb - droop * 0.2)}Z"/>`)

    // Folders on this tier perch at its outer right, a little in; files become tufts spread along the hem.
    const anchor = { x: hw * 0.55, y: yb - th * 0.35 }
    if (tier) for (const p of tier.paths) nodes.set(p, anchor)
    const tierFiles = tier ? tier.files : i === count - 1 ? own : []
    tierFiles.forEach((f, j) => {
      const side = j % 2 ? 1 : -1
      const along = 0.25 + 0.7 * ((Math.floor(j / 2) + 0.5) / Math.ceil(tierFiles.length / 2))
      const at = { x: side * hw * along * 0.92, y: yb - droop * 0.5 - th * 0.18 * (1 - along) }
      nodes.set(f.path, at)
      if (budget-- > 0) out.push(tuft(f.path, at, side * 70, o, 'nd'))
    })
  }
  for (const p of aliases) nodes.set(p, { x: 0, y: 4 - H })
  return { svg: out.join(''), nodes, minX: -halfW * 1.1, maxX: halfW * 1.1, height: H + 10, species }
}

export const TREE_DEFS =
  `<path id="nd" d="M0 0l-2.6 -4.4M0 0l0 -5.2M0 0l2.6 -4.4"/>` +
  `<path id="al" d="M0 0Q2.4 -2.2 0 -5Q-2.4 -2.2 0 0Z"/>`

export const TREE_CSS =
  `.tsh{fill:#000;opacity:.08}.ctk{fill:#5e4232}.ptk{fill:#9a6a45}.pst{stroke:#7a5236;stroke-width:1.2;stroke-linecap:round;fill:none}` +
  `.sp0{fill:#2c5547}.sp1{fill:#3e6f5c}.fr0{fill:#2b5636}.fr1{fill:#3f7646}.pn0{fill:#36623a}.pn1{fill:#4f8549}` +
  `.nd{stroke:#7fb36a;stroke-width:1.1;stroke-linecap:round;fill:none}.ndw{stroke:#e0892f;stroke-width:1.4;stroke-linecap:round;fill:none}` +
  `.awt{fill:#efede4}.awm{stroke:#3f3d38;stroke-width:1;stroke-linecap:round}.ac0{fill:#e8b33c}.ac1{fill:#f2c94c}.ac2{fill:#d4972c}` +
  `.al{fill:#f6d669}.alw{fill:#e06f2f}` +
  `@media (prefers-color-scheme: dark){.tsh{opacity:.3}.ctk{fill:#4a3427}.ptk{fill:#7c5537}.sp0{fill:#1f3f35}.sp1{fill:#2c5546}.fr0{fill:#1f4128}.fr1{fill:#2d5a34}.pn0{fill:#284a2b}.pn1{fill:#3a6638}` +
  `.nd{stroke:#5f9150}.awt{fill:#cfccc0}.ac0{fill:#b98b2c}.ac1{fill:#c9a23c}.ac2{fill:#a87622}.al{fill:#d8b84e}}`

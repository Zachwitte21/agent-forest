import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Doing, FNode, Forest, Pin, Touch } from '../types'
import { DONE_KEEP_MS, drawForest, MOVE_MS, ROLE_NAME, SEATS, treeKey } from './draw'

const PANE = 'agent-forest'
// Asks the dock for as much width as it will give; a width the person dragged still wins.
const WIDE = 400
// The desktop pane's cell size in CSS pixels. The picture stretches to the pane's width, so their ratio is what counts:
// a cell is about 2.28 times taller than wide, and guessing taller makes the picture overflow and the pane scroll.
const COL_PX = 8.3
const ROW_PX = 18.9
// The pane pads its body, so the drawing stays this far inside the measured size or the pane scrolls.
const EDGE_X = 24
const EDGE_Y = 40
type Spot = { x: number; y: number; s: number }
let lastDraw: { key: string; svg: string; spots: Record<string, Spot>; radio: Spot } | null = null
// Set by /forest debug: outlines the hover patches, to check them against what they cover.
let outlinePatches = false
// The hover card over an agent, in pane cells.
const CARD = 32
// The sprite's box in drawing units at scale 1, crown and bob included; its hover patch matches it, so agents side by side keep their own.
const SPRITE_W = 36
const SPRITE_H = 30
// The Claude channel's live address follows whichever stream is on, so a restarted stream's new video id doesn't break it.
// By channel id rather than @claude: the desktop refuses a raw @ in a link, and an id survives a handle rename.
const RADIO_URL = 'https://www.youtube.com/channel/UCV03SRZXJEz-hchIAogeJOg/live'
const RADIO_CARD = 30
// The radio's box in drawing units at scale 1, antenna included, with a little room round it.
const RADIO_W = 30
const RADIO_H = 30

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.cache', 'target', 'coverage', '.turbo', '.DS_Store', 'Pods', 'DerivedData', 'vendor', '.gradle', '.expo', '.svelte-kit', '.parcel-cache', '.pytest_cache', '.mypy_cache', 'site-packages'])
const SHOWN_DOTDIRS = new Set(['.github', '.claude'])
// Folders listed per scan; past it, the rest show as buds.
const MAX_DIRS = 400

const forest = atom({ plugin: 'agent-forest', key: 'forest' } as const, null)
const pins = atom({ plugin: 'agent-forest', key: 'pins' } as const, [])
const touches = atom({ plugin: 'agent-forest', key: 'touches' } as const, {})
// Bumped every few minutes so the sun moves and the sky turns even while nothing else happens.
const tick = atom({ plugin: 'agent-forest', key: 'tick' } as const, 0)
const TICK_MS = 5 * 60 * 1000

const byName = (a: FNode, b: FNode) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1)

/** Breadth first, so a deep folder can't spend the whole budget before its siblings are seen. */
async function scan($: EngineInterface, root: string): Promise<Forest> {
  const top: FNode = { name: '', path: '', kind: 'dir' }
  const queue: Array<{ node: FNode; abs: string }> = [{ node: top, abs: root }]
  let listed = 0
  while (queue.length) {
    const { node, abs } = queue.shift()!
    if (listed >= MAX_DIRS) {
      node.isPartial = true
      continue
    }
    listed++
    let entries
    try {
      entries = await $.fs.list(abs)
    } catch {
      node.isPartial = true
      continue
    }
    const kids: FNode[] = []
    for (const en of entries) {
      if (SKIP.has(en.name)) continue
      const path = node.path ? `${node.path}/${en.name}` : en.name
      if (en.kind === 'dir') {
        if (en.name.startsWith('.') && !SHOWN_DOTDIRS.has(en.name)) continue
        const dir: FNode = { name: en.name, path, kind: 'dir' }
        kids.push(dir)
        queue.push({ node: dir, abs: `${abs}/${en.name}` })
      } else if (en.kind === 'file') {
        kids.push({ name: en.name, path, kind: 'file' })
      }
    }
    node.children = kids.sort(byName)
  }
  const label = root.split('/').filter(Boolean).pop() ?? root
  const kids = top.children ?? []
  const trees = kids.filter(k => k.kind === 'dir')
  const files = kids.filter(k => k.kind === 'file')
  if (files.length || !trees.length) trees.push({ name: label, path: '', kind: 'dir', children: files })
  return { root, label, trees }
}

/** Adds a file written after the scan, growing whatever folders it needs. */
function addFile(f: Forest, rel: string): Forest {
  const next: Forest = JSON.parse(JSON.stringify(f))
  const segs = rel.split('/')
  let node: FNode | undefined
  if (segs.length === 1) {
    node = next.trees.find(t => t.path === '')
    if (!node) next.trees.push((node = { name: next.label, path: '', kind: 'dir', children: [] }))
  } else {
    node = next.trees.find(t => t.path === segs[0])
    if (!node) next.trees.unshift((node = { name: segs[0], path: segs[0], kind: 'dir', children: [] }))
    for (let i = 1; i < segs.length - 1; i++) {
      const path = segs.slice(0, i + 1).join('/')
      node.children ??= []
      let sub: FNode | undefined = node.children.find(c => c.path === path)
      if (!sub) node.children.push((sub = { name: segs[i], path, kind: 'dir', children: [] }))
      node = sub
    }
  }
  node.children ??= []
  if (!node.children.some(c => c.path === rel)) {
    node.children.push({ name: segs[segs.length - 1], path: rel, kind: 'file' })
    node.children.sort(byName)
  }
  return next
}

function relOf(root: string, p: unknown): string | null {
  if (typeof p !== 'string' || !p) return null
  const abs = (p.startsWith('/') ? p : `${root}/${p}`).replace(/\/+$/, '')
  if (abs === root) return ''
  return abs.startsWith(root + '/') ? abs.slice(root.length + 1) : null
}

/** Still on screen: working, or finished less than DONE_KEEP_MS ago. */
const isLive = (p: Pin, at: number) => !p.endedAt || at - p.endedAt < DONE_KEEP_MS

/** A random free camp seat for a new agent, picked from its id so a redraw never reshuffles it. */
function pickSeat(list: Pin[], id: string): number {
  const taken = new Set(list.map(p => p.seat))
  const free = Array.from({ length: SEATS }, (_, i) => i).filter(i => !taken.has(i))
  if (!free.length) return Math.floor(Math.random() * SEATS)
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return free[(h >>> 0) % free.length]
}

/** The outfit a subagent wears, from its type and task. */
function roleOf(type: string, description: string): string {
  const s = `${type} ${description}`.toLowerCase()
  if (/explor|research|search|guide|find/.test(s)) return 'explorer'
  // Checked before planning, since "design" otherwise reads as an architect's job.
  if (/\b(ui|ux)\b|visual|styl|\bart\b|artist|figma|css|theme|colou?r|icon|logo|illustrat|design/.test(s)) return 'artist'
  if (/plan|architect/.test(s)) return 'planner'
  if (/review|audit|security|santa|critic/.test(s)) return 'reviewer'
  if (/test|qa|verif|eval/.test(s)) return 'tester'
  return 'developer'
}

type Move = { doing: Doing; rel: string | null; detail: string; touch?: Touch['kind']; touches?: string[]; spot?: string }

// The lake stands for the internet: web search, page fetches and the browsers all send an agent wading in.
const WEB_TOOL = /^(WebSearch|WebFetch)$|^mcp__.*(browser|chrome|fetch|web|search)/i
// Claude's memory is the campfire: the memory folders under ~/.claude and any MEMORY.md, plus a CLAUDE.md outside the repo.
const MEMORY_PATH = /\/\.claude\/(.*\/)?memory(\/|$)|(^|\/)MEMORY\.md$/i

function isMemory(p: unknown, root: string): boolean {
  if (typeof p !== 'string' || !p) return false
  return MEMORY_PATH.test(p) || (/(^|\/)CLAUDE\.md$/.test(p) && relOf(root, p) === null)
}

function webDetail(a: Record<string, unknown>): string {
  if (typeof a.query === 'string') return a.query
  if (typeof a.url === 'string') return a.url.replace(/^https?:\/\//, '').split('/')[0]
  return 'the web'
}

function classify(tool: string, a: Record<string, unknown>, root: string): Move {
  const path = a.file_path ?? a.notebook_path
  if (WEB_TOOL.test(tool)) return { doing: 'web', rel: null, detail: webDetail(a), spot: 'l:' }
  const memPath = [path, a.path, a.command].find(v => typeof v === 'string' && isMemory(v, root)) ?? (typeof a.command === 'string' && MEMORY_PATH.test(a.command) ? a.command : undefined)
  if (memPath !== undefined) {
    const name = String(memPath).match(/[^/\s'"]+\.md/)?.[0] ?? 'memory'
    const writes = tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit'
    return { doing: 'memory', rel: null, detail: `${writes ? 'saving' : 'recalling'} ${name}`, spot: 'm:' }
  }
  if (tool === 'Read') {
    const rel = relOf(root, path)
    return { doing: 'read', rel, detail: rel ?? String(path ?? ''), touch: 'read' }
  }
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const rel = relOf(root, path)
    return { doing: 'write', rel, detail: rel ?? String(path ?? ''), touch: 'write' }
  }
  if (tool === 'Grep' || tool === 'Glob') {
    const rel = relOf(root, a.path)
    const pattern = typeof a.pattern === 'string' ? a.pattern : ''
    // A search of a folder perches on its branch; a search of everything waits at the trunk.
    return { doing: 'search', rel: rel || null, detail: pattern }
  }
  if (tool === 'Bash' && typeof a.command === 'string') return fromShell(a.command, root)
  return { doing: 'work', rel: null, detail: tool }
}

const SHELL_READ = /\b(cat|sed|head|tail|less|more|grep|rg|awk|wc|nl|bat|diff|jq)\b/
const SHELL_WRITE = /(^|[^>])>(?!&)|\btee\b|\bsed\s+-i\b|\b(mv|cp|rm|touch)\b/

/** Agents often read with cat, sed or grep instead of Read; the files those commands name count too. */
function fromShell(command: string, root: string): Move {
  // A leading cd sets where relative paths start.
  const cd = /^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*(&&|;)/.exec(command)
  const base = cd ? cd[1].replace(/^["']|["']$/g, '') : root
  const rels: string[] = []
  for (const m of command.matchAll(/(?:^|[\s'"=])((?:\/|\.{0,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+)/g)) {
    const raw = m[1]
    const rel = relOf(root, raw.startsWith('/') ? raw : `${base}/${raw.replace(/^\.\//, '')}`)
    if (rel && !rels.includes(rel)) rels.push(rel)
  }
  const isWrite = SHELL_WRITE.test(command)
  if (!rels.length || (!isWrite && !SHELL_READ.test(command))) return { doing: 'work', rel: null, detail: 'Bash' }
  const kind = isWrite ? 'write' : 'read'
  const rel = rels[rels.length - 1]
  return { doing: kind, rel, detail: rels.length > 1 ? `${rel} +${rels.length - 1}` : rel, touch: kind, touches: rels }
}

// After arriving somewhere an agent stays at least this long, so a burst of work reads as settling in, not bouncing about.
const DWELL_MS = 15000
// How long an agent hangs around where it was after finishing before it walks back to camp.
const LINGER_MS = { main: 60000, sub: 15000 }
// Agents with a walk already scheduled, so a burst of moves sets one timer, not one each.
const flushing = new Set<string>()

/** When the agent may set off again: once the walk in has finished and, away from camp, it has stayed a while. */
const readyAt = (p: Pin) => p.movedAt + MOVE_MS + (p.spot === 'f:' ? 0 : DWELL_MS)

/**
 * Redraws once a walk has finished, so the picture on show holds the agent standing still.
 * A picture drawn mid-walk replays that walk from the start whenever the pane reloads it.
 */
function redrawAfterWalk($: EngineInterface) {
  void $.clock.after(MOVE_MS + 100, () => {
    void update($, tick, n => n + 1)
  })
}

/** Sets off for the queued spot once the agent is free to leave, checking again then in case it moved meanwhile. */
function scheduleFlush($: EngineInterface, id: string, waitMs: number) {
  if (flushing.has(id)) return
  flushing.add(id)
  void $.clock.after(Math.max(0, waitMs), () => {
    flushing.delete(id)
    void flushMove($, id)
  })
}

async function flushMove($: EngineInterface, id: string) {
  const at = await $.clock.now()
  let wait = -1
  let walked = false
  await update($, pins, list =>
    list.map(p => {
      if (p.id !== id || !p.queued) return p
      if (at < readyAt(p)) {
        wait = readyAt(p) - at
        return p
      }
      const { queued, ...rest } = p
      if (queued === p.spot) return rest
      walked = true
      return { ...rest, from: p.spot, spot: queued, movedAt: at }
    }),
  )
  if (wait >= 0) scheduleFlush($, id, wait)
  if (walked) redrawAfterWalk($)
}

/** After a turn ends, walks the agent home unless it went back to work in the meantime. */
function scheduleHome($: EngineInterface, id: string, idleAt: number, waitMs: number) {
  void $.clock.after(waitMs, () => {
    void update($, pins, list => list.map(p => (p.id === id && p.idleAt === idleAt && p.spot !== 'f:' ? { ...p, queued: 'f:' } : p)))
      .then(() => flushMove($, id))
      .catch(() => {})
  })
}

const spotPath = (spot: string) => (spot.startsWith('n:') ? spot.slice(2) : spot.slice(2))

/** Where an agent waits during other work: at camp, the lake or the fire it is already at, or under the tree it was last in. */
function groundFor(f: Forest | null, spot: string): string {
  return /^[flm]:/.test(spot) ? spot : `g:${treeKey(f, spotPath(spot))}`
}

async function movePin($: EngineInterface, agentId: string | undefined, m: Move) {
  const at = await $.clock.now()
  const f = await read($, forest)
  const id = agentId ?? 'main'
  let wait = -1
  let walked = false
  await update($, pins, list => {
    const live = list.filter(p => isLive(p, at))
    const was = live.find(p => p.id === id)
    const base: Pin = was ?? {
      id,
      label: id === 'main' ? 'Claude' : 'agent',
      spot: 'f:',
      from: 'f:',
      movedAt: 0,
      doing: 'idle',
      detail: '',
      role: id === 'main' ? 'lead' : 'developer',
      reads: 0,
      writes: 0,
      seat: pickSeat(live, id),
    }
    const spot = m.spot ?? (m.rel !== null ? `n:${m.rel}` : groundFor(f, base.spot))
    const n = m.touch ? (m.touches?.length ?? 1) : 0
    const counted = { ...base, reads: base.reads + (m.touch === 'read' ? n : 0), writes: base.writes + (m.touch === 'write' ? n : 0) }
    // What it's doing changes at once; where it stands waits until it has stayed put long enough.
    // Working again means not done, for a subagent picked back up after it finished, or the cleanup would drop it mid-task.
    const { queued: _, ...settled } = { ...counted, doing: m.doing, detail: m.detail, idleAt: undefined, endedAt: undefined }
    let moved: Pin
    if (spot === base.spot) moved = settled
    else if (at >= readyAt(base)) {
      moved = { ...settled, from: base.spot, spot, movedAt: at }
      walked = true
    } else {
      moved = { ...settled, queued: spot }
      wait = readyAt(base) - at
    }
    return was ? live.map(p => (p.id === id ? moved : p)) : [...live, moved]
  })
  if (wait >= 0) scheduleFlush($, id, wait)
  if (walked) redrawAfterWalk($)
  if (m.touch && m.rel) {
    const kind = m.touch
    const rels = m.touches ?? [m.rel]
    await update($, touches, t => {
      const next = { ...t }
      for (const rel of rels) next[rel] = { kind: t[rel]?.kind === 'write' ? 'write' : kind, at }
      return next
    })
  }
}

// A thought is cut to this many characters before it is kept.
const THOUGHT_CHARS = 140

/**
 * gist
 * The last full sentence of what a subagent was thinking, with markdown and line breaks gone.
 */
export function gist(raw: string): string {
  // Only markdown's own marks go: headings and quotes at a line's start, bold, italics and code ticks.
  // A lone _ or > stays, so forest_test.ts and -> come through whole.
  const flat = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^[ \t]*(#{1,6}|>)[ \t]?/gm, '')
    .replace(/\*+|`|\b__|__\b/g, '')
    // A line that ends without a stop (a heading, a list item) still ends there, or it runs into the next sentence.
    .replace(/([^.!?:\s])[ \t]*\n+/g, '$1.\n')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  // Split only where a stop meets a space, so a file name like register.tsx stays whole.
  const sentences = flat.split(/(?<=[.!?])\s+/)
  const long = (x: string) => x.split(' ').length >= 4
  // A finished sentence beats a tail cut off mid-thought, which is all a step stopped early leaves at the end.
  const pick = [...sentences].reverse().find(x => long(x) && /[.!?]$/.test(x)) ?? [...sentences].reverse().find(long) ?? sentences[sentences.length - 1]
  return pick.length > THOUGHT_CHARS ? pick.slice(0, THOUGHT_CHARS - 1).trimEnd() + '…' : pick
}

// Where a bare name like "my-app" is looked for, under the home folder.
const PROJECT_DIRS = ['Dev', 'dev', 'code', 'Code', 'Projects', 'projects', 'src', '']

/** A bare project name, matched case-insensitively against the usual project folders. */
async function findProject($: EngineInterface, home: string, name: string): Promise<string | null> {
  const want = name.toLowerCase()
  for (const dir of PROJECT_DIRS) {
    const base = dir ? `${home}/${dir}` : home
    const entries = await $.fs.list(base).catch(() => [])
    const hit = entries.find(en => en.kind === 'dir' && en.name.toLowerCase() === want)
    if (hit) return `${base}/${hit.name}`
  }
  return null
}

async function rescan($: EngineInterface, root: string) {
  const f = await scan($, root)
  await update($, forest, () => f)
  await update($, touches, () => ({}))
}

// The day/night timer of this load; a resumed or cleared session runs session.start again, and must not add a second.
let ticker: Timer | null = null

const SPEECH: Record<Doing, string> = { read: 'Reading', write: 'Editing', search: 'Searching', web: 'Searching the web', memory: 'Recalling memory', work: 'Working', idle: 'Taking a break' }

/** The speech bubble's two lines: what the agent is doing, then the file, query or memory it's doing it to. */
function speech(p: Pin): [string, string] {
  if (p.endedAt) return ['Done', p.label]
  if (p.doing === 'memory') {
    const [verb, ...rest] = p.detail.split(' ')
    return [verb === 'saving' ? 'Saving memory' : 'Recalling memory', rest.join(' ')]
  }
  // A path shows as its file name, keeping any "+2" for the other files in the same command.
  const body = p.doing === 'read' || p.doing === 'write' ? p.detail.replace(/^.*\//, '') : p.detail
  if (p.doing === 'idle') return [SPEECH.idle, p.spot.startsWith('f:') ? 'at the campfire' : 'in the forest']
  return [SPEECH[p.doing], body]
}

// The desktop takes whole percentages only.
const pct = (n: number) => `${Math.max(0, n)}%`

/** Something to hover: its feet at (x, y) in drawing units, w across and h tall. */
type Hoverable = { id: string; x: number; y: number; w: number; h: number }
type Patch = { id: string; x0: number; x1: number; y0: number; y1: number }

/**
 * hoverBands
 * Lays each hover patch out in whole percent of the picture, in bands down it and left to right in each, edges rounded from the corner so no error adds up.
 */
export function hoverBands(boxes: Hoverable[], W: number, H: number): Array<{ y0: number; y1: number; items: Patch[] }> {
  const r = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100)
  const patches = boxes.map(b => {
    const y1 = r(b.y / H)
    // At least one percent tall, here rather than when drawn, or the bands below would start a percent off.
    return { id: b.id, x0: r((b.x - b.w / 2) / W), x1: r((b.x + b.w / 2) / W), y0: Math.min(r((b.y - b.h) / H), y1 - 1), y1 }
  })
  const bands: Array<{ y0: number; y1: number; items: Patch[] }> = []
  for (const p of [...patches].sort((a, b) => a.y0 - b.y0)) {
    const last = bands[bands.length - 1]
    if (last && p.y0 < last.y1) {
      last.items.push(p)
      last.y1 = Math.max(last.y1, p.y1)
    } else bands.push({ y0: p.y0, y1: p.y1, items: [p] })
  }
  for (const band of bands) {
    // A patch overlapping its left neighbour is trimmed to start where that one ends.
    band.items.sort((a, b) => a.x0 - b.x0)
    let edge = 0
    band.items = band.items.flatMap(it => {
      const x0 = Math.max(it.x0, edge)
      if (it.x1 - x0 < 1) return []
      edge = it.x1
      return [{ ...it, x0 }]
    })
  }
  return bands
}

async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === PANE)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({
      name: 'forest',
      description: 'Show the repo as a forest and watch Claude and its subagents move through it',
      argumentHint: '[path | refresh]',
      immediate: true,
    })
    const at = await $.clock.now()
    // Pins kept from an older load may predate roles and counts.
    await update($, pins, list => list.map(p => ({ ...p, role: p.role ?? (p.id === 'main' ? 'lead' : 'developer'), reads: p.reads ?? 0, writes: p.writes ?? 0 })))
    // Every seat already held counts as taken, not just those handed out so far, or a later pin's seat could be given away twice.
    await update($, pins, list => list.reduce<Pin[]>((acc, p) => [...acc, p.seat === undefined ? { ...p, seat: pickSeat([...acc, ...list], p.id) } : p], []))
    await update($, pins, list =>
      list.some(p => p.id === 'main')
        ? list
        : [...list, { id: 'main', label: 'Claude', spot: 'f:', from: 'f:', movedAt: 0, doing: 'idle', detail: '', role: 'lead', reads: 0, writes: 0, seat: pickSeat(list, `main-${at}`) }],
    )
    if (!(await read($, forest))) void rescan($, await $.session.cwd())
    ticker?.cancel()
    ticker = $.clock.every(TICK_MS, () => {
      void update($, tick, n => n + 1)
    })
    return r
  })

  on('command.run', { command: 'forest' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    if (arg === 'debug') {
      outlinePatches = !outlinePatches
      await update($, tick, n => n + 1)
      return { text: `Hover patches ${outlinePatches ? 'outlined' : 'hidden'}.` }
    }
    if (!arg) {
      if (await isOpen($)) {
        await $.ui.close({ id: PANE })
        return { text: 'Agent forest closed.' }
      }
      await $.ui.open({ id: PANE, title: 'Agent forest', columns: WIDE })
      return { text: 'Agent forest opened.' }
    }
    const cwd = await $.session.cwd()
    let root = (await read($, forest))?.root ?? cwd
    if (arg !== 'refresh') {
      const home = (await $.env.get('HOME')) ?? ''
      root = arg.startsWith('~') ? home + arg.slice(1) : arg.startsWith('/') ? arg : `${cwd}/${arg}`
      root = root.replace(/\/+$/, '')
      if (!(await $.fs.exists(root)) && !/[/~]/.test(arg)) root = (await findProject($, home, arg)) ?? root
      if (!(await $.fs.exists(root))) return { text: `No folder at ${root}.` }
    }
    await rescan($, root)
    await $.ui.open({ id: PANE, title: 'Agent forest', columns: WIDE })
    return { text: `Agent forest is showing ${root}.` }
  })

  on('tool.call', async ($, e, next) => {
    try {
      const f = await read($, forest)
      const m = classify(e.tool, e as unknown as Record<string, unknown>, f?.root ?? (await $.session.cwd()))
      await movePin($, e.agentId, m)
    } catch {
      // Drawing is never worth failing a tool call over.
    }
    const r = await next(e)
    try {
      const f = await read($, forest)
      const a = e as unknown as Record<string, unknown>
      const rel = f && (e.tool === 'Write' || e.tool === 'NotebookEdit') ? relOf(f.root, a.file_path ?? a.notebook_path) : null
      if (f && rel && !('isError' in r && r.isError)) await update($, forest, cur => (cur ? addFile(cur, rel) : cur))
    } catch {
      // Same as above.
    }
    return r
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined || !r.agentId) return r
    try {
      const at = await $.clock.now()
      const agentId = r.agentId
      await update($, pins, list => {
        const live = list.filter(p => isLive(p, at))
        return [
          ...live.filter(p => p.id !== agentId),
          {
            id: agentId,
            label: e.description || e.subagentType || 'agent',
            spot: 'f:',
            from: 'f:',
            // Free to head out at once: only an agent that has just walked somewhere has to settle first.
            movedAt: 0,
            doing: 'work' as const,
            detail: '',
            role: roleOf(e.subagentType, e.description),
            reads: 0,
            writes: 0,
            seat: pickSeat(live.filter(p => p.id !== agentId), agentId),
          },
        ]
      })
    } catch {
      // Same as above.
    }
    return r
  }).catch(($, e, next) => next(e))

  // Subagents only: the lead's thinking is already on screen in the transcript.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      yield* next(e)
      return
    }
    let thinking = ''
    let said = ''
    // A new block starts a new sentence, so blocks never run together as "pass.Now I'll".
    const last = { thinking: -1, text: -1 }
    const add = (kind: 'thinking' | 'text', index: number, text: string, to: string) => {
      const gap = last[kind] !== -1 && last[kind] !== index && to && !/\s$/.test(to) ? ' ' : ''
      last[kind] = index
      return to + gap + text
    }
    // In a finally so a step cut short, by an interrupt or an abort, still leaves what it thought so far.
    try {
      for await (const c of next(e)) {
        if (c.kind === 'thinking') thinking = add('thinking', c.index, c.text, thinking)
        else if (c.kind === 'text') said = add('text', c.index, c.text, said)
        yield c
      }
    } finally {
      // Some steps stream no thinking; what the agent says between tool calls is the next best thing.
      // A step with neither clears the old thought, so the bubble never shows one from several steps back.
      const thought = gist(thinking) || gist(said) || undefined
      const id = e.agentId
      void update($, pins, list => (list.some(p => p.id === id && p.thought !== thought) ? list.map(p => (p.id === id ? { ...p, thought } : p)) : list)).catch(() => {})
    }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    try {
      const at = await $.clock.now()
      const id = e.agentId ?? 'main'
      // Done agents stay where they were a while, then walk back to camp; subagents then fade out.
      await update($, pins, list =>
        list.map(p => (p.id === id ? { ...p, doing: 'idle' as const, detail: '', idleAt: at, ...(e.agentId ? { endedAt: at } : {}) } : p)),
      )
      scheduleHome($, id, at, e.agentId ? LINGER_MS.sub : LINGER_MS.main)
      // Nothing else may happen for a while, so a finished subagent is cleared on a timer rather than by the next agent's move.
      if (e.agentId)
        void $.clock.after(DONE_KEEP_MS + 100, () => {
          void $.clock
            .now()
            .then(t => update($, pins, list => list.filter(p => isLive(p, t))))
            .catch(() => {})
        })
    } catch {
      // Same as above.
    }
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const f = await read($, forest)
    const list = await read($, pins)
    const t = await read($, touches)
    const now = await $.clock.now()
    await read($, tick)
    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg, Text, Box, Button } = ui
      if (!f) return <Text dimColor>Scanning the folder…</Text>
      const cols = e.props.bodyColumns || 60
      const W = Math.max(280, Math.floor(cols * COL_PX) - EDGE_X)
      const H = Math.max(320, Math.floor((e.props.scroll?.bodyRows || 30) * ROW_PX) - EDGE_Y)

      // The lead and up to twenty subagents, each on the camp seat it was given at random.
      const live = list.filter(p => isLive(p, now))
      const agents = [...live.filter(p => p.id === 'main'), ...live.filter(p => p.id !== 'main').slice(-(SEATS - 1))]

      // Cells to pixels is a guess (the pane reports no pixels), so W and H set the picture's shape, and the picture fills the pane's width.
      // Drawn as an image: an interactive frame reloads, and flashes, on every resize.
      // A new source reloads the picture, so a redraw that changes nothing it shows hands back the same one.
      // A click focuses the pane and the picture reloads, replaying from when it was drawn, so focus earns a fresh one.
      const walking = agents.map(p => now - p.movedAt < MOVE_MS)
      const key = JSON.stringify([W, H, f.root, f.trees.length, agents, walking, t, Math.floor(now / TICK_MS), e.props.isFocused])
      if (!lastDraw || lastDraw.key !== key) {
        const out = drawForest(f, agents, t, now, W, H)
        if (!out) return <Text dimColor>This folder is too big to draw. Try /forest with a subfolder.</Text>
        lastDraw = { key, svg: out.svg, spots: out.spots, radio: out.radio }
      }
      const { spots, radio } = lastDraw
      const byId = new Map(agents.map(p => [p.id, p]))
      const boxes: Hoverable[] = [
        ...agents.flatMap(p => (spots[p.id] ? [{ id: p.id, x: spots[p.id]!.x, y: spots[p.id]!.y, w: SPRITE_W * spots[p.id]!.s, h: SPRITE_H * spots[p.id]!.s }] : [])),
        { id: 'radio', x: radio.x, y: radio.y + 2 * radio.s, w: RADIO_W * radio.s, h: RADIO_H * radio.s },
      ]
      const outline = outlinePatches ? { borderStyle: 'single' as const, borderColor: '#ff0000' } : {}

      return (
        <Box flexDirection="column">
          <Svg key="forest" source={lastDraw.svg} alt={`${f.label}: ${f.trees.length} trees`} />
          {/* One layer over the whole picture; each patch is placed in percent of it, so a wrong guess at the cell size moves nothing. */}
          <Box position="absolute" left={0} right={0} top={0} bottom={0} flexDirection="column">
            {hoverBands(boxes, W, H).flatMap((band, i, all) => [
              <Box height={pct(band.y0 - (i ? all[i - 1]!.y1 : 0))} flexShrink={0} />,
              // Each patch fills its band's full height: neighbours in a band stand side by side, so the extra rows cover no one else.
              <Box height={pct(band.y1 - band.y0)} flexShrink={0} flexDirection="row">
                {band.items.flatMap((it, j, row) => {
                  const isRadio = it.id === 'radio'
                  const width = isRadio ? RADIO_CARD : CARD
                  const across = Math.max(1, Math.round(((it.x1 - it.x0) / 100) * cols))
                  const leftCells = Math.round((it.x0 / 100) * cols)
                  const cardLeft = clamp(-Math.round((width - across) / 2), -leftCells, cols - width - leftCells)
                  const p = byId.get(it.id)
                  const [head, body] = p ? speech(p) : ['', '']
                  return [
                    <Box width={pct(it.x0 - (j ? row[j - 1]!.x1 : 0))} flexShrink={0} />,
                    <Box key={isRadio ? 'radio' : `agent-${it.id}`} width={pct(it.x1 - it.x0)} height="100%" flexShrink={0} flexDirection="column" {...outline}>
                      {/* A zero-height anchor on the patch's top edge, so the card sits right on top with no gap to lose the hover in. */}
                      <Box height={0}>
                        {isRadio ? (
                          <Box
                            position="absolute"
                            bottom={0}
                            left={cardLeft}
                            width={RADIO_CARD}
                            display="none"
                            hover={{ display: 'flex' }}
                            flexDirection="column"
                            borderStyle="round"
                            borderColor="#5a554b"
                            backgroundColor="#2c2b27"
                            paddingX={1}
                          >
                            <Text bold color="#ffffff">Claude FM</Text>
                            <Text color="#c9c5ba">music for thinking and building</Text>
                            <Button key="radio-play" variant="primary" onPress={() => $.process.run(['open', RADIO_URL])}>▶ Listen live</Button>
                          </Box>
                        ) : p ? (
                          <Box
                            position="absolute"
                            bottom={0}
                            left={cardLeft}
                            width={CARD}
                            display="none"
                            hover={{ display: 'flex' }}
                            flexDirection="column"
                            borderStyle="round"
                            // The old-school speech bubble: dark text on white, set outright so neither theme can turn it unreadable.
                            borderColor="#1f1f1f"
                            backgroundColor="#ffffff"
                            paddingX={1}
                          >
                            <Text bold color="#1f1f1f">{head}</Text>
                            {body ? <Text wrap="truncate-start" color="#1f1f1f">{body}</Text> : null}
                            {p.thought && !p.endedAt ? <Text wrap="wrap" italic color="#5a554b">💭 {p.thought}</Text> : null}
                            <Text color="#6b675e">
                              {p.id === 'main' ? 'Claude' : p.label} · <Text color="#c15f3c" bold>{ROLE_NAME[p.role] ?? 'Agent'}</Text> · {p.reads} read · {p.writes} edited
                            </Text>
                          </Box>
                        ) : null}
                      </Box>
                    </Box>,
                  ]
                })}
              </Box>,
            ])}
          </Box>
        </Box>
      )
    }
    const { Box, Text, Link } = ui
    return (
      <Box flexDirection="column">
        <Text bold>{f ? `${f.label}: ${f.trees.length} trees` : 'Scanning the folder…'}</Text>
        {list
          .filter(p => !p.endedAt)
          .map(p => (
            <Text>
              {p.label}: {p.doing} {p.detail}
            </Text>
          ))}
        <Text dimColor>The forest is drawn in the desktop app.</Text>
        <Text>Claude FM: <Link href={RADIO_URL} /></Text>
      </Box>
    )
  })
}

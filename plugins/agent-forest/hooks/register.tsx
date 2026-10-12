import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Doing, FNode, Forest, Pin, Touch } from '../types'
import { DONE_KEEP_MS, drawForest, MOVE_MS, ROLE_NAME, SEATS, treeKey, VERB } from './draw'

const PANE = 'agent-forest'
// Asks the dock for as much width as it will give; a width the person dragged still wins.
const WIDE = 400
// The desktop pane's cell size in CSS pixels, measured from a 65 x 40 cell pane that was 539 x 794 px.
const COL_PX = 8.3
const ROW_PX = 19.8
// The pane pads its body, so the drawing stays this far inside the measured size or the pane scrolls.
const EDGE_X = 24
const EDGE_Y = 48
let lastDraw: { key: string; svg: string; seats: Record<string, { x: number; y: number }>; radio: { x: number; y: number } } | null = null
// The hover card over a seat, in pane cells.
const CARD = 32
// The seat's hover patch is this many rows tall; the card sits right on its top edge.
const SEAT_ROWS = 3
// The radio stands about this many rows tall above the bottom of its hover patch.
const RADIO_ROWS = 3
// The Claude channel's live address follows whichever stream is on, so a restarted stream's new video id doesn't break it.
// By channel id rather than @claude: the desktop refuses a raw @ in a link, and an id survives a handle rename.
const RADIO_URL = 'https://www.youtube.com/channel/UCV03SRZXJEz-hchIAogeJOg/live'
const RADIO_CARD = 30
// The radio's hover patch in cells, about twice the radio's own size.
const RADIO_ZONE = [14, 6]

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
  await update($, pins, list =>
    list.map(p => {
      if (p.id !== id || !p.queued) return p
      if (at < readyAt(p)) {
        wait = readyAt(p) - at
        return p
      }
      const { queued, ...rest } = p
      return queued === p.spot ? rest : { ...rest, from: p.spot, spot: queued, movedAt: at }
    }),
  )
  if (wait >= 0) scheduleFlush($, id, wait)
}

/** After a turn ends, walks the agent home unless it went back to work in the meantime. */
function scheduleHome($: EngineInterface, id: string, idleAt: number, waitMs: number) {
  void $.clock.after(waitMs, () => {
    void update($, pins, list => list.map(p => (p.id === id && p.idleAt === idleAt && p.spot !== 'f:' ? { ...p, queued: 'f:' } : p))).then(() => flushMove($, id))
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
  await update($, pins, list => {
    const live = list.filter(p => !p.endedAt || at - p.endedAt < DONE_KEEP_MS)
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
    const { queued: _, ...settled } = { ...counted, doing: m.doing, detail: m.detail, idleAt: undefined }
    let moved: Pin
    if (spot === base.spot) moved = settled
    else if (at >= readyAt(base)) moved = { ...settled, from: base.spot, spot, movedAt: at }
    else {
      moved = { ...settled, queued: spot }
      wait = readyAt(base) - at
    }
    return was ? live.map(p => (p.id === id ? moved : p)) : [...live, moved]
  })
  if (wait >= 0) scheduleFlush($, id, wait)
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

// Opens the pane once per load, on the first sign of work, rather than at every session start.
let hasAutoOpened = false

async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === PANE)
}

async function autoOpen($: EngineInterface) {
  if (hasAutoOpened) return
  hasAutoOpened = true
  if (!(await isOpen($))) void $.ui.open({ id: PANE, title: 'Agent forest', columns: WIDE })
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
    await update($, pins, list => list.reduce<Pin[]>((acc, p) => [...acc, p.seat === undefined ? { ...p, seat: pickSeat(acc, p.id) } : p], []))
    await update($, pins, list =>
      list.some(p => p.id === 'main')
        ? list
        : [...list, { id: 'main', label: 'Claude', spot: 'f:', from: 'f:', movedAt: 0, doing: 'idle', detail: '', role: 'lead', reads: 0, writes: 0, seat: pickSeat(list, `main-${at}`) }],
    )
    if (!(await read($, forest))) void rescan($, await $.session.cwd())
    $.clock.every(TICK_MS, () => {
      void update($, tick, n => n + 1)
    })
    return r
  })

  on('command.run', { command: 'forest' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
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
      if (m.rel !== null) await autoOpen($)
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
        const live = list.filter(p => !p.endedAt || at - p.endedAt < DONE_KEEP_MS)
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
      await autoOpen($)
    } catch {
      // Same as above.
    }
    return r
  }).catch(($, e, next) => next(e))

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
      const agents = [...list.filter(p => p.id === 'main'), ...list.filter(p => p.id !== 'main').slice(-(SEATS - 1))]

      // Drawn at the pane's exact size as an image: an interactive frame reloads, and flashes, on every resize.
      // A new source reloads the picture, so a redraw that changes nothing it shows hands back the same one.
      const key = JSON.stringify([W, H, f.root, f.trees.length, agents, t, Math.floor(now / TICK_MS)])
      if (!lastDraw || lastDraw.key !== key) {
        const out = drawForest(f, agents, t, now, W, H)
        if (!out) return <Text dimColor>This folder is too big to draw. Try /forest with a subfolder.</Text>
        lastDraw = { key, svg: out.svg, seats: out.seats, radio: out.radio }
      }
      const seats = lastDraw.seats
      const radioLeft = clamp(Math.round(lastDraw.radio.x / COL_PX) - RADIO_ZONE[0] / 2, 0, cols - RADIO_ZONE[0])
      // Counted up from the picture's bottom edge: the camp sits there, and rows counted down from the top drift by the bottom.
      const radioBottom = Math.max(0, Math.round((H - lastDraw.radio.y) / ROW_PX) - 1)

      return (
        <Box flexDirection="column">
          <Svg key="forest" source={lastDraw.svg} alt={`${f.label}: ${f.trees.length} trees`} width={W} height={H} />
          {agents.map(p => {
            const seat = seats[p.id]
            if (!seat) return null
            // An invisible patch of cells over the seat holds the hover card; the picture itself can't take hover.
            const left = clamp(Math.round(seat.x / COL_PX) - 4, 0, cols - 8)
            const bottom = Math.max(0, Math.round((H - seat.y) / ROW_PX) - 1)
            const cardLeft = clamp(-Math.round((CARD - 8) / 2), -left, cols - CARD - left)
            const verb = p.endedAt ? 'done' : p.doing === 'memory' ? 'at the fire' : p.doing === 'web' ? 'in the lake' : VERB[p.doing]
            return (
              <Box key={`seat-${p.id}`} position="absolute" left={left} bottom={bottom} width={8} height={SEAT_ROWS}>
                <Box
                  position="absolute"
                  // Anchored by its bottom so the card sits just over the agent's head however many lines it wraps to.
                  bottom={SEAT_ROWS}
                  left={cardLeft}
                  width={CARD}
                  display="none"
                  hover={{ display: 'flex' }}
                  flexDirection="column"
                  borderStyle="round"
                  // Always the dark card with light text: the theme setting can't be read reliably here, and dark-on-dark was unreadable.
                  borderColor="#5a554b"
                  backgroundColor="#2c2b27"
                  paddingX={1}
                >
                  <Text bold wrap="wrap" color="#ffffff">{p.id === 'main' ? 'Claude' : p.label}</Text>
                  <Text color="#f2efe6"><Text color="#e88d67" bold>{ROLE_NAME[p.role] ?? 'Agent'}</Text> · {verb}</Text>
                  {p.detail ? <Text wrap="truncate-start" color="#c9c5ba">{p.detail}</Text> : <Text color="#c9c5ba">{p.spot.startsWith('f:') ? 'at the campfire' : 'in the forest'}</Text>}
                  <Text color="#c9c5ba">{p.reads} read · {p.writes} edited</Text>
                </Box>
              </Box>
            )
          })}
          {/* A wide patch around the radio, well past its edges, so the card shows wherever on it the pointer lands. */}
          <Box key="radio" position="absolute" left={radioLeft} bottom={radioBottom} width={RADIO_ZONE[0]} height={RADIO_ZONE[1]}>
            <Box
              position="absolute"
              // Sits right on top of the radio: no gap to lose the hover in on the way up to the button.
              bottom={RADIO_ROWS}
              left={clamp(-Math.round((RADIO_CARD - RADIO_ZONE[0]) / 2), -radioLeft, cols - RADIO_CARD - radioLeft)}
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

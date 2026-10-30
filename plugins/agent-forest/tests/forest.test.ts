import { expect, mock, test } from 'claude-code/testing'

import { drawForest, sceneZoom } from '../hooks/draw'
import { gist, hoverBands } from '../hooks/register'
import { drawTree } from '../hooks/trees'
import type { FNode, Forest, Pin } from '../types'

const F: Forest = {
  root: '/r',
  label: 'r',
  trees: [
    {
      name: 'src',
      path: 'src',
      kind: 'dir',
      children: [
        { name: 'lib', path: 'src/lib', kind: 'dir', children: [{ name: 'b.ts', path: 'src/lib/b.ts', kind: 'file' }] },
        { name: 'a.ts', path: 'src/a.ts', kind: 'file' },
      ],
    },
    { name: 'r', path: '', kind: 'dir', children: [{ name: 'README.md', path: 'README.md', kind: 'file' }] },
  ],
}

const PANE_PROPS = { title: 'Agent forest', isFocused: false, bodyColumns: 80, placement: 'dock' } as never

test('a tree grows the same shape every time', () => {
  expect(drawForest(F, [], {}, 0, 600)!.svg).toBe(drawForest(F, [], {}, 0, 600)!.svg)
})

test('draws a pin mid-walk with no speech bubble, its file named for hover', () => {
  const pin = { id: 'main', label: 'Claude', spot: 'n:src/lib/b.ts', from: 'g:', movedAt: 1000, doing: 'read' as const, detail: 'src/lib/b.ts', role: 'lead', reads: 1, writes: 0 }
  const out = drawForest(F, [pin], { 'src/a.ts': { kind: 'write', at: 0 } }, 1300, 600)
  expect(out === null).toBe(false)
  expect(out!.svg).toContain('@keyframes m0')
  expect(out!.svg).not.toContain('class="sb"')
  expect(out!.svg).toContain('src/lib/b.ts')
})

test('a huge repo still fits the Svg budget', () => {
  const trees: FNode[] = []
  for (let t = 0; t < 30; t++) {
    const dirs: FNode[] = []
    for (let d = 0; d < 10; d++) {
      const files: FNode[] = []
      for (let i = 0; i < 40; i++) files.push({ name: `f${i}.ts`, path: `t${t}/d${d}/f${i}.ts`, kind: 'file' })
      dirs.push({ name: `d${d}`, path: `t${t}/d${d}`, kind: 'dir', children: files })
    }
    trees.push({ name: `t${t}`, path: `t${t}`, kind: 'dir', children: dirs })
  }
  const out = drawForest({ root: '/big', label: 'big', trees }, [], {}, 0, 900)
  expect(out === null).toBe(false)
  expect(out!.svg.length).toBeLessThanOrEqual(128000)
})

// A tiny folder for the scan: /r holds src/ and README.md, src holds a.ts.
const DISK: Record<string, Array<{ name: string; kind: 'file' | 'dir' }>> = {
  '/r': [{ name: 'src', kind: 'dir' }, { name: 'README.md', kind: 'file' }, { name: 'node_modules', kind: 'dir' }],
  '/r/src': [{ name: 'a.ts', kind: 'file' }],
}

test('the pane draws on terminal and desktop', async ($, on) => {
  mock.clock(on)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('config.list', () => ({ value: [] }))
  let opened: readonly string[] = []
  on('process.run', ($, e) => {
    opened = e.argv
    return { value: { code: 0, stdout: '', stderr: '' } } as never
  })
  await $.command.run({ command: 'forest', args: '/r' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agent-forest', surface, component: 'Pane', requestId: 'agent-forest', props: PANE_PROPS })
    if (surface === 'desktop') {
      const svg = await ui.find({ type: 'Svg' })
      if (!svg) console.log(JSON.stringify(await ui.drawn()).slice(0, 600))
      expect(svg?.type).toBe('Svg')
      const radio = await ui.find({ type: 'Button' })
      expect(radio?.type).toBe('Button')
      await ui.press({ key: 'radio-play' })
      expect(opened.join(' ')).toBe('open https://www.youtube.com/channel/UCV03SRZXJEz-hchIAogeJOg/live')
    }
    await ui.unmount()
  }
})

test('an agent settles in before moving on, and lingers before walking home', async ($, on) => {
  const clock = mock.clock(on)
  // A real wall-clock time: a fresh agent's last move is at 0, long settled by then.
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  on('turn.complete', () => ({ text: 'done' }))
  // The pins as last written, watched on their way to the store.
  let held: Pin[] = []
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'pins') held = (e as unknown as { value: Pin[] }).value
    return next(e)
  })
  const main = async () => held.find(p => p.id === 'main')!
  await $.command.run({ command: 'forest', args: '/r' } as never)

  await $.tool.call({ tool: 'WebSearch', query: 'banff' } as never)
  expect((await main()).spot).toBe('l:')
  // A read right after: it stays at the lake for now and heads to the file once it has settled in.
  await clock.advance(2000)
  await $.tool.call({ tool: 'Read', file_path: '/r/src/a.ts' } as never)
  expect((await main()).spot).toBe('l:')
  expect((await main()).queued).toBe('n:src/a.ts')
  await clock.advance(20000)
  expect((await main()).spot).toBe('n:src/a.ts')

  // Turn over: still by the file a while later, back at camp after the linger.
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  await clock.advance(30000)
  expect((await main()).spot).toBe('n:src/a.ts')
  await clock.advance(60000)
  expect((await main()).spot).toBe('f:')
})

test('all eight animals are out in the scene', () => {
  const svg = drawForest(F, [], {}, 0, 900, 800)!.svg
  // Each animal's classes carry its own prefix: elk, grizzly, black bear, moose, bighorn sheep, loon, marmot, eagle.
  for (const prefix of ['ek', 'gz', 'bb', 'ms', 'bh', 'ln', 'mm', 'eg']) expect(svg).toMatch(new RegExp(`(class|href)="[^"]*\\b#?${prefix}-`))
})

test('thought bubbles over a crowded tree stack instead of overlapping', () => {
  const pins = ['a.ts', 'lib/b.ts'].flatMap((_, k) =>
    [0, 1, 2].map(i => ({ id: `p${k}${i}`, label: 'agent', spot: 'n:src/a.ts', from: 'n:src/a.ts', movedAt: 0, doing: 'read' as const, detail: `src/file-${k}${i}.ts`, role: 'reviewer', reads: 1, writes: 0, thought: `Checking whether file ${k}${i} matters here.` })),
  )
  const svg = drawForest(F, pins, {}, 0, 900, 800)!.svg
  // Each bubble's box in the picture: its agent's spot plus the rect's left edge, top and width.
  const boxes = [...svg.matchAll(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\([\d.]+\)"><g[^>]*><g class="tk"[^>]*><g transform="scale\([\d.]+\)"><rect class="sb" x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)"/g)].map(m => {
    const [x, y, l, t, w] = m.slice(1).map(Number) as [number, number, number, number, number]
    return { x0: x + l, x1: x + l + w, top: y + t }
  })
  expect(boxes.length).toBe(6)
  // Side by side is fine; any two bubbles that share a column stack at least a bubble's height apart.
  for (const a of boxes) for (const b of boxes) if (a !== b && a.x0 < b.x1 && b.x0 < a.x1) expect(Math.abs(a.top - b.top)).toBeGreaterThan(29)
})

/** A repo with one folder per entry in sizes, each holding that many files. */
function repo(sizes: number[]): Forest {
  const trees: FNode[] = sizes.map((n, t) => ({
    name: `d${t}`,
    path: `d${t}`,
    kind: 'dir',
    children: Array.from({ length: n }, (_, i) => ({ name: `f${i}.ts`, path: `d${t}/f${i}.ts`, kind: 'file' as const })),
  }))
  return { root: '/s', label: 's', trees }
}

/** Each drawn tree's trunk foot, scale and drawn height, read back from the picture. */
function treesIn(f: Forest, W: number, H: number) {
  const svg = drawForest(f, [], {}, 0, W, H)!.svg
  // Each tree's group is followed by its name, which finds the folder it was drawn from.
  return [...svg.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)" opacity="[\d.]+">.*?<\/g><text class="tx lb"[^>]*>([^<]+)<\/text>/g)].map(m => {
    const tree = f.trees.find(t => t.name === m[4])!
    return { x: Number(m[1]), y: Number(m[2]), h: drawTree(tree, { now: 0, touches: {}, maxTufts: 0 }).height * Number(m[3]) }
  })
}

test('a one-folder repo grows one proud tree, not a sapling', () => {
  const [tree] = treesIn(repo([3]), 1267, 1025)
  expect(tree!.h).toBeGreaterThan(tree!.y * 0.75)
})

test('a 3-file folder still stands tall beside a big one, and the big one still reads bigger', () => {
  const [big, small] = treesIn(repo([200, 3]), 1267, 1025).sort((a, b) => b.h - a.h)
  expect(small!.h).toBeGreaterThan(big!.h * 0.45)
  expect(big!.h).toBeGreaterThan(small!.h * 1.4)
})

test('a small repo packs its trees either side of the trail, never on it', () => {
  for (const W of [1267, 640]) {
    for (let n = 1; n <= 8; n++) {
      const trees = treesIn(repo(Array.from({ length: n }, (_, i) => 40 - i * 5)), W, W === 640 ? 760 : 1025)
      expect(trees.length).toBe(n)
      // Trees sit on the zoomed stage, which is the pane shrunk by the zoom; the trail runs between about 0.39 and 0.44 of its width.
      const sw = Math.round(W / sceneZoom(n))
      for (const t of trees) expect(t.x < sw * 0.37 || t.x > sw * 0.46).toBe(true)
      for (const t of trees) expect(t.x > 0 && t.x < sw).toBe(true)
    }
  }
})

test("a small repo's root-file bushes stay off the trail and out from behind its trees", () => {
  const f = repo([30, 12, 4])
  f.trees.push({ name: 's', path: '', kind: 'dir', children: Array.from({ length: 12 }, (_, i) => ({ name: `r${i}.md`, path: `r${i}.md`, kind: 'file' as const })) })
  const svg = drawForest(f, [], {}, 0, 1267, 1025)!.svg
  const trees = treesIn(f, 1267, 1025)
  const bushes = [...svg.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\) scale\([\d.]+\)"><ellipse class="sh"/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }))
  expect(bushes.length).toBe(12)
  // No bush hides on the ground straight behind a tree, where its trunk and lower branches would cover it.
  for (const b of bushes) for (const t of trees) expect(b.y > t.y || b.y < t.y - t.h || Math.abs(b.x - t.x) > 24).toBe(true)
})

test('a small repo zooms the whole scene in, a big one does not', () => {
  const small = drawForest(F, [], {}, 0, 900, 800)!
  // The stage is laid out smaller than the pane and the svg scales it up to fill it.
  const box = (svg: string) => svg.match(/viewBox="0 0 (\d+) (\d+)"/)!.slice(1).map(Number)
  expect(box(small.svg)[0]).toBeLessThan(700)
  expect(small.height).toBe(800)
  const trees: FNode[] = Array.from({ length: 12 }, (_, t) => ({ name: `t${t}`, path: `t${t}`, kind: 'dir', children: [{ name: 'a.ts', path: `t${t}/a.ts`, kind: 'file' }] }))
  expect(box(drawForest({ root: '/b', label: 'b', trees }, [], {}, 0, 900, 800)!.svg)[0]).toBe(900)
})

test('a subagent sometimes shows its latest thought, the lead never does', () => {
  const sub: Pin = { id: 'a1', label: 'Explore', spot: 'n:src/a.ts', from: 'n:src/a.ts', movedAt: 0, doing: 'read', detail: 'src/a.ts', role: 'explorer', reads: 1, writes: 0, thought: 'The pane opens from register.tsx so I should check it next.' }
  const svg = drawForest(F, [sub], {}, 60000, 600)!.svg
  expect(svg).toContain('class="tk"')
  expect(svg).toContain('register.tsx so I should')
  const lead = drawForest(F, [{ ...sub, id: 'main' }], {}, 60000, 600)!.svg
  expect(lead).not.toContain('class="tk"')
})

test('a thought keeps the last full sentence, file names whole', () => {
  expect(gist('Okay. Now I need to **look** at `register.tsx` for the bug.\n\nHmm.')).toBe('Now I need to look at register.tsx for the bug.')
  expect(gist('')).toBe('')
  expect(gist('Check forest_test.ts first -> then draw.ts for the bug.')).toBe('Check forest_test.ts first -> then draw.ts for the bug.')
  expect(gist('> quoted\n## Plan\nThe radio sits too close to the fire. I will now check the')).toBe('The radio sits too close to the fire.')
})

test('once an agent has waded into the lake, the picture stops replaying the walk', async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.command.run({ command: 'forest', args: '/r' } as never)
  const ui = await $.ui.mount({ plugin: 'agent-forest', surface: 'desktop', component: 'Pane', requestId: 'agent-forest', props: PANE_PROPS })
  const source = async () => String(((await ui.find({ type: 'Svg' })) as unknown as { props: { source: string } }).props.source)
  await $.tool.call({ tool: 'WebSearch', query: 'banff' } as never)
  expect(await source()).toContain('@keyframes m0')
  await clock.advance(1000)
  await $.tool.call({ tool: 'WebSearch', query: 'lake louise' } as never)
  expect(await source()).toContain('@keyframes m0')
  await clock.advance(5000)
  expect(await source()).not.toContain('@keyframes m0')
  await ui.unmount()
})

test('a finished subagent leaves the picture after a while, even when nothing else happens', async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: 'done' }))
  let held: Pin[] = []
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'pins') held = (e as unknown as { value: Pin[] }).value
    return next(e)
  })
  await $.command.run({ command: 'forest', args: '/r' } as never)
  await $.agent.spawn({ prompt: 'look around', description: 'Explore wildlife', subagentType: 'Explore' } as never)
  expect(held.some(p => p.id === 'a1')).toBe(true)
  await $.turn.complete({ reason: 'answer', answer: 'done', agentId: 'a1' } as never)
  await clock.advance(60000)
  expect(held.some(p => p.id === 'a1')).toBe(true)
  await clock.advance(40000)
  expect(held.some(p => p.id === 'a1')).toBe(false)
})

test('hovering an agent out in the forest shows its speech bubble', async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.command.run({ command: 'forest', args: '/r' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/r/src/a.ts' } as never)
  const ui = await $.ui.mount({ plugin: 'agent-forest', surface: 'desktop', component: 'Pane', requestId: 'agent-forest', props: PANE_PROPS })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('agent-main')
  expect(drawn).toContain('Reading')
  expect(drawn).toContain('a.ts')
  await ui.unmount()
})

test('a subagent picked back up after it finished is working again, not cleared as done', async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  on('turn.complete', () => ({ text: 'done' }))
  let held: Pin[] = []
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'pins') held = (e as unknown as { value: Pin[] }).value
    return next(e)
  })
  await $.command.run({ command: 'forest', args: '/r' } as never)
  await $.agent.spawn({ prompt: 'look around', description: 'Explore wildlife', subagentType: 'Explore' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', agentId: 'a1' } as never)
  await clock.advance(10000)
  await $.tool.call({ tool: 'Read', file_path: '/r/src/a.ts', agentId: 'a1' } as never)
  const a1 = () => held.find(p => p.id === 'a1')
  expect(a1()?.endedAt).toBe(undefined)
  await clock.advance(100000)
  expect(a1()?.doing).toBe('read')
})

test('hover patches sit over their sprites in percent of the picture, side by side without overlapping', () => {
  const box = (id: string, x: number, y: number) => ({ id, x, y, w: 36, h: 30 })
  const bands = hoverBands([box('a', 400, 500), box('b', 420, 505), box('c', 100, 900), box('d', 600, 100.4)], 800, 1000)
  // A patch thinner than a percent still gets one, so the bands below it don't start a percent off.
  expect(bands[0]!.items[0]!.id).toBe('d')
  expect(bands[0]!.y1 - bands[0]!.y0).toBeGreaterThan(0)
  const [, top, bottom] = bands
  // Whole percents: feet at the patch's bottom edge, centred across.
  expect(top!.items[0]!.x0).toBe(Math.round(((400 - 18) / 800) * 100))
  expect(top!.items[0]!.y1).toBe(50)
  // The neighbour starts where the first ends.
  expect(top!.items[1]!.x0).toBe(top!.items[0]!.x1)
  expect(bottom!.items[0]!.id).toBe('c')
})

test("a subagent's thought blocks are kept apart, so one block's last sentence never runs into the next", async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(1_700_000_000_000)
  mock.env(on, { HOME: '/home' })
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', ($, e) => ({ value: (DISK[e.path] ?? []).map(en => ({ ...en, size: 0, mtimeMs: 0, isLink: false })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  on('turn.step', async function* () {
    yield { kind: 'thinking', index: 0, text: 'The tests all pass.' } as never
    yield { kind: 'thinking', index: 1, text: 'Now I will read the draw file next' } as never
    return { turnId: 't1', index: 0, answer: '', toolUses: [] } as never
  })
  let held: Pin[] = []
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'pins') held = (e as unknown as { value: Pin[] }).value
    return next(e)
  })
  await $.command.run({ command: 'forest', args: '/r' } as never)
  await $.agent.spawn({ prompt: 'look around', description: 'Explore wildlife', subagentType: 'Explore' } as never)
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: 'a1' } as never)) void _
  await clock.advance(10)
  expect(held.find(p => p.id === 'a1')?.thought).toBe('The tests all pass.')
})

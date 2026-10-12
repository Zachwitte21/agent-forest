export type FNode = {
  name: string
  /** Relative to the forest root; '' for the root's own files. */
  path: string
  kind: 'dir' | 'file'
  children?: FNode[]
  /** The scan budget ran out before this folder was listed. */
  isPartial?: boolean
}

export type Forest = {
  root: string
  label: string
  trees: FNode[]
}

export type Doing = 'read' | 'write' | 'search' | 'web' | 'memory' | 'work' | 'idle'

export type Pin = {
  /** 'main' for the session's own loop, else the subagent's id. */
  id: string
  label: string
  /** 'n:<path>' sits on a leaf or branch, 'g:<tree>' sits on the ground under a tree, 'f:' waits at its camp seat, 'l:' is in the lake (the web), 'm:' is by the fire (memory). */
  spot: string
  from: string
  movedAt: number
  doing: Doing
  detail: string
  /** The outfit: lead, explorer, developer, planner, reviewer, tester or artist. */
  role: string
  reads: number
  writes: number
  /** The camp seat this agent was given, at random, for as long as it lives. */
  seat?: number
  endedAt?: number
  /** Where it heads next, once it has stayed put long enough where it is. */
  queued?: string
  /** When it last went idle, so a stale walk-home timer can tell newer work happened since. */
  idleAt?: number
}

export type Touch = { kind: 'read' | 'write'; at: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-forest': {
      forest: Forest | null
      pins: Pin[]
      touches: Record<string, Touch>
      /** Counts the day/night redraw timer's ticks. */
      tick: number
    }
  }
}

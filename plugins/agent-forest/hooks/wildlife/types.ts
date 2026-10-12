/**
 * wildlife/types.ts
 * What the scene tells each animal about the world it roams, all in scene pixels (y grows downward).
 */

export type P = { x: number; y: number }
export type Box = { x0: number; x1: number; y0: number; y1: number }

export type World = {
  W: number
  H: number
  /** Wall-clock ms. The picture is rebuilt often, so start each loop at -(now % period) or a redraw snaps it back to the start. */
  now: number
  /** Where the sky meets the ground. */
  horizon: number
  /** Roughly the y of the highest peaks; the mountains fill from here down to the horizon across the whole width. */
  peaks: number
  /** Open grass between the front row of trees and the camp. */
  meadow: Box
  /** A strip of ground along the front row of trees, where the forest opens onto the meadow. */
  forestEdge: Box
  /** The lake's water, an ellipse. A dock runs from the front edge, and camp agents wade in the front half. */
  lake: { c: P; rx: number; ry: number }
  /** How big things look standing on the ground at y: about 0.5 at the horizon, 1 at the top of camp. */
  depth: (y: number) => number
  /** True when a circle of radius r around ground point (x, y) misses the trail, bushes, tree trunks, the camp and the lake. */
  isClear: (x: number, y: number, r: number) => boolean
}

/** Every animal module exports these. CSS classes and DEFS ids carry the module's own two-letter prefix. A herd may also
 * split itself with drawParts, one piece per animal with the ground y it stands on, for depth order. */
export type Animal = { CSS: string; DEFS: string; draw: (w: World) => string; drawParts?: (w: World) => Array<{ y: number; svg: string }> }

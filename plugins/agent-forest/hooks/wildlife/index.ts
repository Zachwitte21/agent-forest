/**
 * wildlife/index.ts
 * The animals of the scene, grouped by the layer each is painted in.
 */

import * as blackbear from './blackbear'
import * as eagle from './eagle'
import * as elk from './elk'
import * as grizzly from './grizzly'
import * as loon from './loon'
import * as marmot from './marmot'
import * as moose from './moose'
import * as sheep from './sheep'
import type { Animal, World } from './types'

export type { World } from './types'

// Sky over the mountains; slopes above the horizon; open ground in front of the trees; on and around the lake.
const LAYERS = { sky: [eagle], slopes: [sheep], ground: [marmot, elk, grizzly, blackbear], lake: [moose, loon] } satisfies Record<string, Animal[]>
const ALL: Animal[] = Object.values(LAYERS).flat()

export const CSS = ALL.map(a => a.CSS).join('')
export const DEFS = ALL.map(a => a.DEFS).join('')

export function drawLayer(layer: keyof typeof LAYERS, w: World): string {
  return LAYERS[layer].map(a => a.draw(w)).join('')
}

/**
 * The ground animals one by one, each with the ground y it mostly stands on, so the scene can paint it in depth order
 * with the trees and bushes instead of over all of them.
 */
export function drawGround(w: World): Array<{ y: number; svg: string }> {
  return LAYERS.ground.flatMap((a: Animal) => {
    if (a.drawParts) return a.drawParts(w)
    const svg = a.draw(w)
    // Every animal places itself with translates, as attributes or in its keyframes; the middle one is where it spends its time.
    const ys = [...svg.matchAll(/translate[:(]\s*-?[\d.]+(?:px)?[ ,]+(-?[\d.]+)/g)].map(m => Number(m[1])).sort((p, q) => p - q)
    return [{ y: ys.length ? ys[ys.length >> 1] : w.meadow.y1, svg }]
  })
}

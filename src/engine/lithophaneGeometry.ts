import type * as THREE from 'three'
import { sampleHeightmap } from '../lib/imageToHeightmap'
import { buildReliefPanel } from './reliefPanel'
import type { Heightmap } from './types'

/**
 * A flat image-relief panel ("lithophane"): thickness varies per-pixel with image
 * brightness (dark = thick, light = thin), so backlighting reveals the picture in
 * grayscale. See reliefPanel.ts for the shared watertight-panel construction.
 */

export interface LithophanePanelParams {
  heightmap: Heightmap
  widthMm: number
  heightMm: number
  minThickness: number
  maxThickness: number
  invert: boolean
  /** Grid resolution along each axis; higher = more detail, more triangles. */
  resolution: number
}

export function buildLithophanePanel(p: LithophanePanelParams): THREE.BufferGeometry {
  const wall = Math.max(0.1, p.maxThickness - p.minThickness)
  return buildReliefPanel({
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    resolution: p.resolution,
    thicknessAt: (u, v) => {
      let brightness = sampleHeightmap(p.heightmap, u, v)
      if (p.invert) brightness = 1 - brightness
      return p.minThickness + (1 - brightness) * wall
    },
  })
}

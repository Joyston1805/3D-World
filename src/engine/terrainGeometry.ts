import type * as THREE from 'three'
import { sampleHeightmap } from '../lib/imageToHeightmap'
import { buildReliefPanel } from './reliefPanel'
import type { Heightmap } from './types'

/**
 * A real-elevation-data relief panel — the same watertight relief-panel technique as
 * the Photo Panel (lithophane), but the height source is real-world terrain elevation
 * instead of image brightness (see src/lib/elevation.ts). Inspired by TrailPrint3D /
 * 3DTrails-style 3D-printed topographic maps.
 */

export interface TerrainPanelParams {
  elevationGrid: Heightmap
  /** Real elevation range (max - min) of the sampled area, meters. */
  elevationRangeM: number
  /** Real-world width/height of the sampled square, km. */
  spanKm: number
  widthMm: number
  baseThickness: number
  /** 1 = true-to-scale relief (usually imperceptibly subtle); higher exaggerates it. */
  verticalExaggeration: number
  resolution: number
}

export function buildTerrainPanel(p: TerrainPanelParams): THREE.BufferGeometry {
  // "True to scale" relief height if this map were a scale model with no exaggeration:
  // real elevation range (m) times the panel's own horizontal scale factor.
  const trueScaleReliefMm = p.elevationRangeM * (p.widthMm / (p.spanKm * 1000))
  const reliefMm = Math.max(0.1, trueScaleReliefMm * Math.max(0, p.verticalExaggeration))

  return buildReliefPanel({
    widthMm: p.widthMm,
    heightMm: p.widthMm, // sampled as a square area, so the panel is square too
    resolution: p.resolution,
    thicknessAt: (u, v) => {
      const normalized = sampleHeightmap(p.elevationGrid, u, v)
      return p.baseThickness + normalized * reliefMm
    },
  })
}

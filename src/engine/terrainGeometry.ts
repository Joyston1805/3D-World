import type * as THREE from 'three'
import { latLonToUV } from '../lib/geo'
import type { GpxPoint } from '../lib/gpx'
import { sampleHeightmap } from '../lib/imageToHeightmap'
import { buildReliefPanel } from './reliefPanel'
import type { Heightmap } from './types'

/**
 * A real-elevation-data relief panel — the same watertight relief-panel technique as
 * the Photo Panel (lithophane), but the height source is real-world terrain elevation
 * instead of image brightness (see src/lib/elevation.ts). Optionally also embosses a
 * GPX route as a raised line traced over the terrain (see src/lib/gpx.ts) — the
 * signature look of sites like Type II Studio's GPX-route wall art.
 */

export interface TerrainPanelParams {
  elevationGrid: Heightmap
  /** Real elevation range (max - min) of the sampled area, meters. */
  elevationRangeM: number
  /** Real-world width/height of the sampled square, km. */
  spanKm: number
  centerLat: number
  centerLon: number
  widthMm: number
  baseThickness: number
  /** 1 = true-to-scale relief (usually imperceptibly subtle); higher exaggerates it. */
  verticalExaggeration: number
  resolution: number
  /** Optional GPX route to emboss as a raised line over the terrain. */
  route?: GpxPoint[]
  routeEmbossHeight: number
  routeWidth: number
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function buildTerrainPanel(p: TerrainPanelParams): THREE.BufferGeometry {
  // "True to scale" relief height if this map were a scale model with no exaggeration:
  // real elevation range (m) times the panel's own horizontal scale factor.
  const trueScaleReliefMm = p.elevationRangeM * (p.widthMm / (p.spanKm * 1000))
  const reliefMm = Math.max(0.1, trueScaleReliefMm * Math.max(0, p.verticalExaggeration))

  // Pre-convert the route to normalized (u,v) once, not per grid sample.
  const routeUV =
    p.route && p.route.length > 1
      ? p.route.map((pt) => latLonToUV(pt.lat, pt.lon, p.centerLat, p.centerLon, p.spanKm))
      : null
  const routeWidthUV = p.routeWidth / p.widthMm

  const routeInfluenceAt = (u: number, v: number): number => {
    if (!routeUV) return 0
    let minDist = Infinity
    for (let i = 0; i < routeUV.length - 1; i++) {
      const d = pointToSegmentDistance(u, v, routeUV[i].u, routeUV[i].v, routeUV[i + 1].u, routeUV[i + 1].v)
      if (d < minDist) minDist = d
      if (minDist === 0) break
    }
    const halfWidth = routeWidthUV / 2
    return Math.max(0, 1 - minDist / halfWidth)
  }

  return buildReliefPanel({
    widthMm: p.widthMm,
    heightMm: p.widthMm, // sampled as a square area, so the panel is square too
    resolution: p.resolution,
    thicknessAt: (u, v) => {
      const normalized = sampleHeightmap(p.elevationGrid, u, v)
      const terrainThickness = p.baseThickness + normalized * reliefMm
      const routeBump = routeInfluenceAt(u, v) * p.routeEmbossHeight
      return terrainThickness + routeBump
    },
  })
}

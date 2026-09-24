import * as THREE from 'three'
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
  /** If set, the mesh gets per-triangle colors by elevation band (lowest first) for the preview. */
  bandColors?: THREE.Color[]
}

/** Printed height of the terrain relief (top of highest point minus base), in mm. */
export function terrainReliefMm(elevationRangeM: number, widthMm: number, spanKm: number, exaggeration: number): number {
  const trueScaleReliefMm = elevationRangeM * (widthMm / (spanKm * 1000))
  return Math.max(0.1, trueScaleReliefMm * Math.max(0, exaggeration))
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
  const reliefMm = terrainReliefMm(p.elevationRangeM, p.widthMm, p.spanKm, p.verticalExaggeration)

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

  const panel = buildReliefPanel({
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
  const bands = p.bandColors
  if (!bands) return panel

  // Color by absolute Z, exactly as a print with filament changes at layer heights comes
  // out: cut every triangle at the band heights so colors form clean horizontal bands.
  const thresholds = Array.from({ length: bands.length - 1 }, (_, i) => p.baseThickness + ((i + 1) * reliefMm) / bands.length)
  return colorByZBands(panel, thresholds, bands)
}

/** [x, y, z, nx, ny, nz] */
type Vert = number[]

/** Sutherland-Hodgman against the plane z = zc, keeping the side given by `above`. */
function clipZ(poly: Vert[], zc: number, above: boolean): Vert[] {
  const inside = (v: Vert) => (above ? v[2] >= zc : v[2] <= zc)
  const out: Vert[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ia = inside(a)
    const ib = inside(b)
    if (ia) out.push(a)
    if (ia !== ib) {
      // Interpolate from the lower-Z end so two triangles sharing an edge compute
      // bit-identical cut points (keeps the split mesh watertight).
      const [lo, hi] = a[2] <= b[2] ? [a, b] : [b, a]
      const t = (zc - lo[2]) / (hi[2] - lo[2])
      out.push(lo.map((v, k) => (k === 2 ? zc : v + t * (hi[k] - v))))
    }
  }
  return out
}

function colorByZBands(panel: THREE.BufferGeometry, thresholds: number[], bandColors: THREE.Color[]): THREE.BufferGeometry {
  const src = panel.toNonIndexed()
  const pos = src.getAttribute('position')
  const nor = src.getAttribute('normal')
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []

  for (let t = 0; t < pos.count; t += 3) {
    const tri: Vert[] = [0, 1, 2].map((k) => [
      pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k), nor.getX(t + k), nor.getY(t + k), nor.getZ(t + k),
    ])
    for (let band = 0; band < bandColors.length; band++) {
      let poly = tri
      if (band > 0) poly = clipZ(poly, thresholds[band - 1], true)
      if (poly.length >= 3 && band < thresholds.length) poly = clipZ(poly, thresholds[band], false)
      if (poly.length < 3) continue
      const color = bandColors[band]
      for (let i = 1; i < poly.length - 1; i++) {
        const [a, b, c] = [poly[0], poly[i], poly[i + 1]]
        const cross = [
          (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ]
        if (Math.hypot(cross[0], cross[1], cross[2]) < 1e-9) continue // sliver from a cut through a vertex
        for (const v of [a, b, c]) {
          positions.push(v[0], v[1], v[2])
          normals.push(v[3], v[4], v[5])
          colors.push(color.r, color.g, color.b)
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

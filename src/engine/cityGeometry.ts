import * as THREE from 'three'
import { assignBands, bandColors, baseColor } from './cityPalette'
import { circleOutline, ColoredMeshBuilder, isSimplePolygon } from './coloredMeshBuilder'
import type { ParamValues } from './types'

/**
 * Two ways to make a city, sharing one plate + colored-prism + palette pipeline:
 *  - buildCityscape: a procedural, seeded skyline on a street grid.
 *  - buildCityMap: real building footprints (from OpenStreetMap) extruded to real heights.
 *
 * Z-up, millimeters. Buildings are embedded slightly into the plate (and tiers into
 * each other) so touching shells interpenetrate rather than sharing coplanar faces —
 * slicers union overlapping shells cleanly.
 */

const EMBED = 0.3

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function addPlate(b: ColoredMeshBuilder, round: boolean, sizeMm: number, thickness: number, color: THREE.Color) {
  if (round) b.addPrism(circleOutline(sizeMm / 2), 0, thickness, color)
  else b.addBox(-sizeMm / 2, -sizeMm / 2, sizeMm / 2, sizeMm / 2, 0, thickness, color)
}

// ---------- procedural cityscape ----------

export interface CityscapeParams {
  seed: number
  round: boolean
  sizeMm: number
  cells: number
  /** Street width as a percentage of one grid cell. */
  streetPct: number
  minHeight: number
  maxHeight: number
  /** 0 = heights random everywhere, 1 = tallest towers cluster downtown. */
  downtownFocus: number
  parkChance: number
  tierChance: number
  spireChance: number
  plateThickness: number
  colors: ParamValues
}

interface Lot {
  x0: number
  y0: number
  x1: number
  y1: number
  height: number
  tiered: boolean
  spire: boolean
}

export function buildCityscape(p: CityscapeParams): THREE.BufferGeometry {
  const rand = mulberry32(Math.round(p.seed) * 7919 + 13)
  const cells = Math.max(2, Math.round(p.cells))
  const cellSize = p.sizeMm / cells
  const half = p.sizeMm / 2
  const streetHalf = (cellSize * p.streetPct) / 200
  const radius = half

  const lots: Lot[] = []
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const cx = -half + (i + 0.5) * cellSize
      const cy = -half + (j + 0.5) * cellSize
      const r = rand()
      const parkRoll = rand()
      const insets = [rand(), rand(), rand(), rand()].map((v) => v * cellSize * 0.12)
      const tierRoll = rand()
      const spireRoll = rand()
      if (parkRoll < p.parkChance) continue

      const x0 = cx - cellSize / 2 + streetHalf + insets[0]
      const x1 = cx + cellSize / 2 - streetHalf - insets[1]
      const y0 = cy - cellSize / 2 + streetHalf + insets[2]
      const y1 = cy + cellSize / 2 - streetHalf - insets[3]
      if (x1 - x0 < 1 || y1 - y0 < 1) continue

      if (p.round) {
        const corners: [number, number][] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ]
        if (corners.some(([x, y]) => Math.hypot(x, y) > radius - 1)) continue
      }

      const d = Math.min(1, Math.hypot(cx, cy) / radius)
      const focus = Math.max(0, Math.min(1, p.downtownFocus))
      const score = (1 - focus) * r + focus * (0.35 * r + 0.65 * Math.pow(1 - d, 1.5) * (0.4 + 0.6 * r))
      const height = p.minHeight + (p.maxHeight - p.minHeight) * Math.max(0, Math.min(1, score))
      const tall = height > p.minHeight + (p.maxHeight - p.minHeight) * 0.45
      lots.push({
        x0,
        y0,
        x1,
        y1,
        height,
        tiered: tall && tierRoll < p.tierChance,
        spire: tall && spireRoll < p.spireChance,
      })
    }
  }

  const bands = assignBands(
    lots.map((l) => l.height),
    p.colors,
  )
  const palette = bandColors(p.colors)
  const builder = new ColoredMeshBuilder()
  addPlate(builder, p.round, p.sizeMm, p.plateThickness, baseColor(p.colors))

  const zBase = p.plateThickness - EMBED
  lots.forEach((lot, idx) => {
    const color = palette[bands[idx]]
    const w = lot.x1 - lot.x0
    const dpt = lot.y1 - lot.y0
    const cx = (lot.x0 + lot.x1) / 2
    const cy = (lot.y0 + lot.y1) / 2
    const top = p.plateThickness + lot.height

    let topZ = top
    if (lot.tiered) {
      // Wedding-cake setbacks: full-width body, then two narrower stacked tiers.
      const bodyTop = p.plateThickness + lot.height * 0.6
      const tier2Top = p.plateThickness + lot.height * 0.85
      builder.addBox(lot.x0, lot.y0, lot.x1, lot.y1, zBase, bodyTop, color)
      const i2x = w * 0.16
      const i2y = dpt * 0.16
      builder.addBox(lot.x0 + i2x, lot.y0 + i2y, lot.x1 - i2x, lot.y1 - i2y, bodyTop - EMBED, tier2Top, color)
      const i3x = w * 0.32
      const i3y = dpt * 0.32
      builder.addBox(lot.x0 + i3x, lot.y0 + i3y, lot.x1 - i3x, lot.y1 - i3y, tier2Top - EMBED, top, color)
    } else {
      builder.addBox(lot.x0, lot.y0, lot.x1, lot.y1, zBase, top, color)
    }

    if (lot.spire) {
      const s = Math.max(0.4, Math.min(w, dpt) * 0.08)
      const spireH = Math.max(2, lot.height * 0.22)
      builder.addBox(cx - s, cy - s, cx + s, cy + s, topZ - EMBED, topZ + spireH, color)
      topZ += spireH
    }
  })

  return builder.build()
}

// ---------- real-footprint city map ----------

/**
 * Footprints are stored in the design as one flat number[] so they ride the same
 * setParam channel as everything else: repeated `[heightM, pointCount, u0, v0, u1, v1, ...]`
 * with (u,v) in [0,1] over the fetched square (v=0 is north).
 */
export interface Footprint {
  heightM: number
  points: [number, number][]
}

export function encodeFootprints(list: Footprint[]): number[] {
  const out: number[] = []
  for (const f of list) {
    out.push(f.heightM, f.points.length)
    for (const [u, v] of f.points) out.push(u, v)
  }
  return out
}

export function decodeFootprints(flat: number[]): Footprint[] {
  const out: Footprint[] = []
  let i = 0
  while (i + 1 < flat.length) {
    const heightM = flat[i]
    const n = flat[i + 1]
    i += 2
    if (n < 3 || i + n * 2 > flat.length) break
    const points: [number, number][] = []
    for (let k = 0; k < n; k++) points.push([flat[i + k * 2], flat[i + k * 2 + 1]])
    i += n * 2
    out.push({ heightM, points })
  }
  return out
}

export interface CityMapParams {
  footprints: number[]
  spanKm: number
  widthMm: number
  plateThickness: number
  /** Multiplier on true-to-scale building height (real cities are far too flat at desk scale). */
  heightExaggeration: number
  minHeightMm: number
  colors: ParamValues
}

const MIN_FOOTPRINT_AREA_MM2 = 0.4
const MIN_EDGE_MM = 0.05

function polygonArea(pts: [number, number][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}

export function buildCityMap(p: CityMapParams): THREE.BufferGeometry {
  const mmPerM = p.widthMm / (p.spanKm * 1000)
  const half = p.widthMm / 2
  const clamp = (v: number) => Math.max(-half, Math.min(half, v))

  const buildings: { outline: [number, number][]; heightMm: number }[] = []
  for (const f of decodeFootprints(p.footprints)) {
    const outline: [number, number][] = []
    for (const [u, v] of f.points) {
      const x = clamp((u - 0.5) * p.widthMm)
      const y = clamp((0.5 - v) * p.widthMm)
      const last = outline[outline.length - 1]
      if (last && Math.hypot(x - last[0], y - last[1]) < MIN_EDGE_MM) continue
      outline.push([x, y])
    }
    while (outline.length > 1 && Math.hypot(outline[0][0] - outline[outline.length - 1][0], outline[0][1] - outline[outline.length - 1][1]) < MIN_EDGE_MM) {
      outline.pop()
    }
    if (outline.length < 3 || polygonArea(outline) < MIN_FOOTPRINT_AREA_MM2) continue
    if (!isSimplePolygon(outline)) continue
    const heightMm = Math.max(p.minHeightMm, f.heightM * mmPerM * p.heightExaggeration)
    buildings.push({ outline, heightMm })
  }

  const bands = assignBands(
    buildings.map((b) => b.heightMm),
    p.colors,
  )
  const palette = bandColors(p.colors)
  const builder = new ColoredMeshBuilder()
  addPlate(builder, false, p.widthMm, p.plateThickness, baseColor(p.colors))
  buildings.forEach((b, i) => {
    builder.addPrism(b.outline, p.plateThickness - EMBED, p.plateThickness + b.heightMm, palette[bands[i]])
  })
  return builder.build()
}

import * as THREE from 'three'
import type { PerforationParams } from './perforate'
import { applyPerforation } from './perforate'

/**
 * Generates a watertight, manifold, 3D-printable shell by revolving a
 * parametric radius profile around the Y axis. This is the shared geometry
 * kernel behind every catalog entry.
 *
 * All units are millimeters (1 scene unit = 1mm) to match slicer expectations.
 */

export type CurveStyle = 'straight' | 'bulge' | 'cinch' | 'sketch'
export type EndMode = 'open' | 'solid'
export type TextureStyle = 'none' | 'ribs' | 'waves' | 'organic'
export type CrossSectionStyle = 'circle' | 'superformula'

export interface RevolveShellParams {
  height: number
  bottomDiameter: number
  topDiameter: number
  curveStyle: CurveStyle
  curveAmount: number
  /** 'sketch' only: normalized radius samples (0..1, 0=bottom to 1=top), 1.0 = widest point. */
  sketchProfile: number[]
  /** 'sketch' only: mm radius that a sketch value of 1.0 maps to. */
  sketchScale: number
  /** Total rotation (degrees) applied smoothly from bottom to top. */
  twist: number
  /** Horizontal cross-section shape: a plain circle, or a Gielis superformula curve
   *  (flowers, stars, gears, polygons — https://en.wikipedia.org/wiki/Superformula). */
  crossSectionStyle: CrossSectionStyle
  /** Rotational symmetry (petal/point count). */
  sfM: number
  sfN1: number
  sfN2: number
  sfN3: number
  textureStyle: TextureStyle
  /** Perturbation amplitude, mm. */
  textureAmount: number
  /** Repeats around the circumference (also the noise scale for 'organic'). */
  textureFrequency: number
  /** 'waves' only: how many times the wave pattern spirals top-to-bottom. */
  textureSpiral: number
  wallThickness: number
  sides: number
  heightSegments: number
  bottomMode: EndMode
  topMode: EndMode
  /** Real cut-through holes (honeycomb/circle-punch), via boolean CSG. */
  perforation: PerforationParams
}

/**
 * Gielis superformula in polar form, normalized to a max radius of 1 so it can be
 * used as a multiplicative cross-section mask independent of the silhouette scale.
 * r(angle) = [ |cos(m*angle/4)/a|^n2 + |sin(m*angle/4)/b|^n3 ]^(-1/n1)
 */
function makeSuperformulaMask(m: number, n1: number, n2: number, n3: number): (angle: number) => number {
  const raw = (angle: number): number => {
    const t1 = Math.abs(Math.cos((m * angle) / 4))
    const t2 = Math.abs(Math.sin((m * angle) / 4))
    const sum = Math.max(1e-6, Math.pow(t1, n2) + Math.pow(t2, n3))
    return Math.min(1e6, Math.pow(sum, -1 / n1))
  }
  let max = 0
  const samples = 360
  for (let i = 0; i < samples; i++) {
    max = Math.max(max, raw((i / samples) * Math.PI * 2))
  }
  max = Math.max(1e-6, max)
  return (angle: number) => raw(angle) / max
}

/** Cheap deterministic pseudo-noise (sum of irrationally-related sines) — no external deps. */
function organicNoise(t: number, angle: number, freq: number): number {
  const tt = t * Math.PI * 2
  const n1 = Math.sin(freq * angle * 1.0 + tt * 1.7)
  const n2 = Math.sin(freq * angle * 2.13 - tt * 0.8 + 1.3)
  const n3 = Math.sin(freq * angle * 0.37 + tt * 3.1 + 2.7)
  return (n1 + n2 * 0.5 + n3 * 0.33) / 1.83
}

function rotateXZ(x: number, z: number, rad: number): [number, number] {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [x * c - z * s, x * s + z * c]
}

/** Linear interpolation into a sparse normalized-radius sample array. */
function sampleProfile(profile: number[], t: number): number {
  if (profile.length === 0) return 1
  if (profile.length === 1) return profile[0]
  const pos = Math.max(0, Math.min(1, t)) * (profile.length - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(profile.length - 1, i0 + 1)
  const frac = pos - i0
  return profile[i0] * (1 - frac) + profile[i1] * frac
}

export function buildRevolveShell(p: RevolveShellParams): THREE.BufferGeometry {
  const segsH = Math.max(4, Math.round(p.heightSegments))
  const segsR = Math.max(3, Math.round(p.sides))
  const rBottom = p.bottomDiameter / 2
  const rTop = p.topDiameter / 2
  const height = Math.max(1, p.height)
  const wall = Math.max(0.2, p.wallThickness)
  const twistRad = (p.twist * Math.PI) / 180

  const baseOuterRadius = (t: number): number => {
    if (p.curveStyle === 'sketch') {
      return Math.max(1, sampleProfile(p.sketchProfile, t) * p.sketchScale)
    }
    const linear = rBottom + (rTop - rBottom) * t
    let bulge = 0
    if (p.curveStyle === 'bulge') bulge = p.curveAmount * Math.sin(Math.PI * t)
    else if (p.curveStyle === 'cinch') bulge = -p.curveAmount * Math.sin(Math.PI * t)
    return Math.max(1, linear + bulge)
  }

  const textureOffset = (t: number, angle: number): number => {
    if (p.textureStyle === 'none' || p.textureAmount <= 0) return 0
    if (p.textureStyle === 'ribs') return p.textureAmount * 0.5 * Math.cos(angle * p.textureFrequency)
    if (p.textureStyle === 'waves')
      return p.textureAmount * 0.5 * Math.cos(angle * p.textureFrequency + p.textureSpiral * t * Math.PI * 2)
    return p.textureAmount * 0.5 * organicNoise(t, angle, p.textureFrequency)
  }

  const crossSectionMask =
    p.crossSectionStyle === 'superformula' ? makeSuperformulaMask(p.sfM, p.sfN1, p.sfN2, p.sfN3) : null

  const outerRadius = (t: number, angle: number): number => {
    const silhouette = baseOuterRadius(t)
    const shaped = crossSectionMask ? silhouette * crossSectionMask(angle) : silhouette
    return Math.max(0.5, shaped + textureOffset(t, angle))
  }

  const innerRadius = (t: number, angle: number): number => Math.max(0.3, outerRadius(t, angle) - wall)

  const yInnerStart = p.bottomMode === 'solid' ? wall : 0
  const yInnerEnd = p.topMode === 'solid' ? height - wall : height

  const positions: number[] = []
  const indices: number[] = []

  const pushVert = (x: number, y: number, z: number): number => {
    positions.push(x, y, z)
    return positions.length / 3 - 1
  }

  const angleOf = (j: number) => (j / segsR) * Math.PI * 2

  // Build outer and inner vertex rings. Texture (ribs/waves/organic) is
  // sampled in the *untwisted* angle so ribs/waves spiral naturally when
  // twist is applied, matching classic "twisted vase mode" prints.
  const outerRing: number[][] = []
  const innerRing: number[][] = []
  for (let i = 0; i <= segsH; i++) {
    const t = i / segsH
    const y = t * height
    const twist = twistRad * t
    const row: number[] = []
    for (let j = 0; j < segsR; j++) {
      const angle = angleOf(j)
      const r = outerRadius(t, angle)
      const [x, z] = rotateXZ(r * Math.cos(angle), r * Math.sin(angle), twist)
      row.push(pushVert(x, y, z))
    }
    outerRing.push(row)

    const yInner = yInnerStart + (yInnerEnd - yInnerStart) * t
    const tInner = yInner / height
    const twistInner = twistRad * tInner
    const rowInner: number[] = []
    for (let j = 0; j < segsR; j++) {
      const angle = angleOf(j)
      const r = innerRadius(tInner, angle)
      const [x, z] = rotateXZ(r * Math.cos(angle), r * Math.sin(angle), twistInner)
      rowInner.push(pushVert(x, yInner, z))
    }
    innerRing.push(rowInner)
  }

  // Outer wall: outward-facing normals use winding (a,c,b) + (a,d,c).
  for (let i = 0; i < segsH; i++) {
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      const a = outerRing[i][j]
      const b = outerRing[i][j2]
      const c = outerRing[i + 1][j2]
      const d = outerRing[i + 1][j]
      indices.push(a, c, b, a, d, c)
    }
  }

  // Inner wall: inward-facing normals use winding (a,b,c) + (a,c,d).
  for (let i = 0; i < segsH; i++) {
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      const a = innerRing[i][j]
      const b = innerRing[i][j2]
      const c = innerRing[i + 1][j2]
      const d = innerRing[i + 1][j]
      indices.push(a, b, c, a, c, d)
    }
  }

  // Bottom end.
  if (p.bottomMode === 'open') {
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      const a = outerRing[0][j]
      const b = outerRing[0][j2]
      const c = innerRing[0][j2]
      const d = innerRing[0][j]
      indices.push(a, b, c, a, c, d)
    }
  } else {
    const center = pushVert(0, 0, 0)
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      indices.push(center, outerRing[0][j], outerRing[0][j2])
    }
    const centerInner = pushVert(0, yInnerStart, 0)
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      indices.push(centerInner, innerRing[0][j2], innerRing[0][j])
    }
  }

  // Top end.
  if (p.topMode === 'open') {
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      const a = innerRing[segsH][j]
      const b = innerRing[segsH][j2]
      const c = outerRing[segsH][j2]
      const d = outerRing[segsH][j]
      indices.push(a, b, c, a, c, d)
    }
  } else {
    const center = pushVert(0, height, 0)
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      indices.push(center, outerRing[segsH][j2], outerRing[segsH][j])
    }
    const centerInner = pushVert(0, yInnerEnd, 0)
    for (let j = 0; j < segsR; j++) {
      const j2 = (j + 1) % segsR
      indices.push(centerInner, innerRing[segsH][j], innerRing[segsH][j2])
    }
  }

  let geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Revolve is already centered on the Y axis; leave Y alone so the
  // object's bottom sits at y=0, matching a print-bed origin.
  geometry.computeBoundingBox()

  if (p.perforation.style !== 'none') {
    const avgRadius = (outerRadius(0, 0) + outerRadius(0.5, 0) + outerRadius(1, 0)) / 3
    const sampleOuterSurface = (t: number, angle: number) => {
      const y = t * height
      const twist = twistRad * t
      const r = outerRadius(t, angle)
      const [x, z] = rotateXZ(r * Math.cos(angle), r * Math.sin(angle), twist)
      const [nx, nz] = rotateXZ(Math.cos(angle), Math.sin(angle), twist)
      return { x, y, z, normal: new THREE.Vector3(nx, 0, nz) }
    }
    geometry = applyPerforation(geometry, height, wall, avgRadius, sampleOuterSurface, p.perforation)
  }

  return geometry
}

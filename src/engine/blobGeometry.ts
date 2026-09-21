import * as THREE from 'three'

/**
 * Noise-displaced icosphere: the standard technique behind open-source procedural
 * rock/gem/asteroid generators (e.g. Three.js "SeedRock"-style tools) — start from a
 * subdivided icosahedron, push each vertex outward/inward along its own radial
 * direction by a 3D noise function, and either keep smooth shared-vertex normals
 * (organic boulder) or split to flat per-face normals (faceted crystal/gem).
 */

export interface BlobParams {
  radius: number
  /** Icosahedron subdivision level. Low = few large facets (gem-like), high = dense/organic. */
  detail: number
  noiseAmount: number
  noiseScale: number
  seed: number
  faceted: boolean
  /** Flattens the top and bottom by this fraction of the radius (0 = untouched sphere). */
  squash: number
}

/** Cheap deterministic 3D value-noise (sum of irrationally-related sine products) — no external deps. */
function noise3D(x: number, y: number, z: number, seed: number): number {
  const s = seed * 37.17
  const n1 = Math.sin(x * 1.3 + s) * Math.cos(y * 1.7 - s * 0.6) * Math.sin(z * 0.9 + s * 0.3)
  const n2 = Math.sin(x * 2.6 - s * 1.3) * Math.cos(y * 3.1 + s * 0.9) * Math.sin(z * 2.1 - s * 0.7)
  const n3 = Math.sin(x * 5.2 + s * 2.1) * Math.cos(y * 4.7 - s * 1.5) * Math.sin(z * 5.5 + s * 1.1)
  return (n1 + n2 * 0.5 + n3 * 0.25) / 1.75
}

export function buildBlob(p: BlobParams): THREE.BufferGeometry {
  const detail = Math.max(0, Math.min(5, Math.round(p.detail)))
  let geometry: THREE.BufferGeometry = new THREE.IcosahedronGeometry(Math.max(1, p.radius), detail)

  const pos = geometry.getAttribute('position')
  const dir = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize()
    const n = noise3D(dir.x * p.noiseScale, dir.y * p.noiseScale, dir.z * p.noiseScale, p.seed)
    const displaced = p.radius + n * p.noiseAmount
    let y = dir.y * displaced
    if (p.squash > 0) y *= 1 - p.squash * (1 - dir.y * dir.y)
    pos.setXYZ(i, dir.x * displaced, y, dir.z * displaced)
  }
  pos.needsUpdate = true

  if (p.faceted && geometry.index) geometry = geometry.toNonIndexed()
  geometry.computeVertexNormals()

  // Sit on the print bed: shift up so the lowest point is at y=0.
  geometry.computeBoundingBox()
  const minY = geometry.boundingBox!.min.y
  geometry.translate(0, -minY, 0)
  geometry.computeBoundingBox()
  return geometry
}

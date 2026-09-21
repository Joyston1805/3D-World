import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'
import { getManifoldModule } from './manifoldSingleton'

/**
 * Real cut-through perforation (honeycomb/circle-punch patterns) via boolean CSG
 * subtraction — unlike the ribs/waves/organic texture layer, which only displaces the
 * surface, this actually removes material, letting light through and giving true
 * geometric lamp-shade patterns (the classic "honeycomb lamp" look).
 *
 * Uses manifold-3d (WASM), not three-bvh-csg: three-bvh-csg produced consistently
 * non-manifold output (dozens of open-boundary edges) specifically for "drill a hole
 * radially through a curved/cylindrical wall" — exactly this use case — which turned
 * out to be a known, still-open upstream issue (their own README points to
 * manifold-3d for robustness). manifold-3d handles the same cases with zero
 * non-manifold edges, verified directly against this app's manifold-check tooling.
 */

export type PerforationStyle = 'none' | 'hexagon' | 'circle'

export interface PerforationParams {
  style: PerforationStyle
  /** Center-to-center hole spacing, mm. */
  cellSize: number
  /** Hole size as a fraction of cellSize (0..1) — the rest stays solid wall/strut. */
  holeRatio: number
}

export interface SurfacePoint {
  x: number
  y: number
  z: number
  normal: THREE.Vector3
}

const MAX_HOLES = 700

function threeGeometryToManifoldMesh(wasm: NonNullable<ReturnType<typeof getManifoldModule>>, geo: THREE.BufferGeometry) {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo
  const pos = nonIndexed.getAttribute('position')
  const vertProperties = new Float32Array(pos.array as Float32Array)
  const triVerts = new Uint32Array(pos.count)
  for (let i = 0; i < pos.count; i++) triVerts[i] = i
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties, triVerts })
  mesh.merge()
  return mesh
}

/**
 * Cuts a grid of holes through `shellGeometry`'s wall, tiled across a revolved
 * surface. `sample(t, angle)` must return the shell's outer-surface position and
 * outward normal at that (height, angle) — including twist/cross-section/texture, so
 * holes land exactly on the real surface regardless of those other parameters.
 *
 * Returns `shellGeometry` unchanged if the manifold-3d WASM module hasn't finished
 * loading yet (see manifoldSingleton.ts) — the caller's next recompute will pick up
 * the perforation once it has.
 */
export function applyPerforation(
  shellGeometry: THREE.BufferGeometry,
  height: number,
  wallThickness: number,
  avgRadius: number,
  sample: (t: number, angle: number) => SurfacePoint,
  p: PerforationParams,
): THREE.BufferGeometry {
  if (p.style === 'none' || p.cellSize <= 0) return shellGeometry

  const wasm = getManifoldModule()
  if (!wasm) return shellGeometry

  let cellSize = Math.max(2, p.cellSize)
  const circumference = 2 * Math.PI * Math.max(1, avgRadius)
  const isHex = p.style === 'hexagon'
  const rowSpacing0 = isHex ? cellSize * (Math.sqrt(3) / 2) : cellSize
  const margin = cellSize * 0.6
  const usableHeight = Math.max(0, height - margin * 2)

  let cols = Math.max(3, Math.round(circumference / cellSize))
  let rows = Math.max(1, Math.floor(usableHeight / rowSpacing0))

  // Defensive cap: if params would generate an unreasonable hole count (e.g. a tiny
  // cellSize on a large shape), scale the effective cell size up to stay performant.
  if (cols * rows > MAX_HOLES) {
    const scale = Math.sqrt((cols * rows) / MAX_HOLES)
    cellSize *= scale
    cols = Math.max(3, Math.round(circumference / cellSize))
    rows = Math.max(1, Math.floor(usableHeight / (isHex ? cellSize * (Math.sqrt(3) / 2) : cellSize)))
  }

  const rowSpacing = isHex ? cellSize * (Math.sqrt(3) / 2) : cellSize
  const dTheta = (2 * Math.PI) / cols
  const holeRadius = (cellSize * Math.max(0.1, Math.min(0.98, p.holeRatio))) / 2
  const cutDepth = wallThickness * 6 + holeRadius * 0.5 // generous: clears both surfaces cleanly
  const radialSegments = isHex ? 6 : 20

  const up = new THREE.Vector3(0, 1, 0)
  const cutterGeoms: THREE.BufferGeometry[] = []

  for (let row = 0; row <= rows; row++) {
    const y = margin + row * rowSpacing
    if (y >= height - margin * 0.5) continue
    const t = Math.min(1, Math.max(0, y / height))
    const rowOffset = isHex && row % 2 === 1 ? dTheta / 2 : 0
    for (let col = 0; col < cols; col++) {
      const angle = col * dTheta + rowOffset
      const pt = sample(t, angle)
      const geo = new THREE.CylinderGeometry(holeRadius, holeRadius, cutDepth, radialSegments)
      const quat = new THREE.Quaternion().setFromUnitVectors(up, pt.normal)
      const center = new THREE.Vector3(pt.x, pt.y, pt.z)
      geo.applyMatrix4(new THREE.Matrix4().compose(center, quat, new THREE.Vector3(1, 1, 1)))
      cutterGeoms.push(geo)
    }
  }

  if (cutterGeoms.length === 0) return shellGeometry

  const mergedCutters = mergeBufferGeometries(cutterGeoms, false) as THREE.BufferGeometry

  const shellMesh = threeGeometryToManifoldMesh(wasm, shellGeometry)
  const cutterMesh = threeGeometryToManifoldMesh(wasm, mergedCutters)
  const shellManifold = new wasm.Manifold(shellMesh)
  const cutterManifold = new wasm.Manifold(cutterMesh)
  const resultManifold = shellManifold.subtract(cutterManifold)
  const resultMesh = resultManifold.getMesh()

  const resultGeometry = new THREE.BufferGeometry()
  resultGeometry.setAttribute('position', new THREE.Float32BufferAttribute(resultMesh.vertProperties, resultMesh.numProp))
  resultGeometry.setIndex(new THREE.BufferAttribute(resultMesh.triVerts, 1))
  resultGeometry.computeVertexNormals()
  resultGeometry.computeBoundingBox()

  shellManifold.delete()
  cutterManifold.delete()
  resultManifold.delete()

  return resultGeometry
}

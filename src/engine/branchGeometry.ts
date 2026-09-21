import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'

/**
 * Recursive branching structure (coral / root / tree form) built from tapered
 * cylinder segments joined by spheres, in the spirit of classic procedural
 * L-system / "space colonization" branch generators. Each segment and joint is
 * individually a closed, watertight solid; overlapping solids union correctly
 * under a slicer's standard nonzero-winding fill rule, so no boolean CSG step
 * is needed for this to print cleanly.
 */

export interface BranchParams {
  seed: number
  depth: number
  branchesPerNode: number
  baseLength: number
  baseRadius: number
  lengthRatio: number
  radiusRatio: number
  spreadAngle: number
  upwardBias: number
  radialSegments: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildBranch(p: BranchParams): THREE.BufferGeometry {
  const rng = mulberry32(Math.round(p.seed))
  const radialSegments = Math.max(4, Math.round(p.radialSegments))
  const maxDepth = Math.max(0, Math.min(6, Math.round(p.depth)))
  const branchesPerNode = Math.max(1, Math.min(5, Math.round(p.branchesPerNode)))
  const spreadRad = (p.spreadAngle * Math.PI) / 180
  const up = new THREE.Vector3(0, 1, 0)

  const geoms: THREE.BufferGeometry[] = []

  const addCylinder = (from: THREE.Vector3, to: THREE.Vector3, radiusStart: number, radiusEnd: number) => {
    const length = from.distanceTo(to)
    if (length < 1e-4) return
    const direction = to.clone().sub(from).normalize()
    const geo = new THREE.CylinderGeometry(radiusEnd, radiusStart, length, radialSegments, 1, false)
    const quat = new THREE.Quaternion().setFromUnitVectors(up, direction)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    geo.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)))
    geoms.push(geo)
  }

  const addJoint = (at: THREE.Vector3, radius: number) => {
    const geo = new THREE.SphereGeometry(radius, Math.max(6, Math.round(radialSegments * 0.75)), 6)
    geo.translate(at.x, at.y, at.z)
    geoms.push(geo)
  }

  function grow(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radiusStart: number,
    depth: number,
  ) {
    const radiusEnd = Math.max(0.3, radiusStart * 0.88)
    const end = origin.clone().addScaledVector(direction, length)
    addCylinder(origin, end, radiusStart, radiusEnd)
    addJoint(end, radiusEnd)

    if (depth <= 0 || radiusEnd < 0.5 || length < 2) return

    for (let k = 0; k < branchesPerNode; k++) {
      const azimuth = (k / branchesPerNode) * Math.PI * 2 + (rng() - 0.5) * 0.8
      const tilt = spreadRad * (0.5 + (rng() - 0.5) * 0.6)

      let perp = new THREE.Vector3(1, 0, 0)
      if (Math.abs(direction.dot(perp)) > 0.9) perp = new THREE.Vector3(0, 0, 1)
      perp.crossVectors(direction, perp).normalize()
      const tiltAxis = perp.clone().applyAxisAngle(direction, azimuth)

      const childDir = direction.clone().applyAxisAngle(tiltAxis, tilt)
      childDir.lerp(up, p.upwardBias * 0.35).normalize()

      grow(end, childDir, length * p.lengthRatio, radiusEnd * p.radiusRatio, depth - 1)
    }
  }

  grow(new THREE.Vector3(0, 0, 0), up, p.baseLength, p.baseRadius, maxDepth)

  const merged = mergeBufferGeometries(geoms, false) as THREE.BufferGeometry
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  return merged
}

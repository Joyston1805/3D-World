import * as THREE from 'three'

/**
 * In-place Laplacian smoothing: each vertex moves partway toward the average of its
 * edge-connected neighbors. The index buffer (topology) never changes, only positions —
 * so a watertight mesh stays watertight, it just loses voxel-grid faceting. Normals are
 * recomputed from the smoothed positions afterward.
 */
export function smoothGeometry(geometry: THREE.BufferGeometry, iterations: number, factor = 0.5): THREE.BufferGeometry {
  const index = geometry.getIndex()
  if (!index || iterations <= 0) return geometry
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const vertexCount = pos.count

  const neighbors: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>())
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t)
    const b = index.getX(t + 1)
    const c = index.getX(t + 2)
    neighbors[a].add(b).add(c)
    neighbors[b].add(a).add(c)
    neighbors[c].add(a).add(b)
  }

  let current = Float32Array.from(pos.array as ArrayLike<number>)
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Float32Array(current.length)
    for (let v = 0; v < vertexCount; v++) {
      const nbrs = neighbors[v]
      const vx = current[v * 3]
      const vy = current[v * 3 + 1]
      const vz = current[v * 3 + 2]
      if (nbrs.size === 0) {
        next[v * 3] = vx
        next[v * 3 + 1] = vy
        next[v * 3 + 2] = vz
        continue
      }
      let sx = 0
      let sy = 0
      let sz = 0
      for (const n of nbrs) {
        sx += current[n * 3]
        sy += current[n * 3 + 1]
        sz += current[n * 3 + 2]
      }
      next[v * 3] = THREE.MathUtils.lerp(vx, sx / nbrs.size, factor)
      next[v * 3 + 1] = THREE.MathUtils.lerp(vy, sy / nbrs.size, factor)
      next[v * 3 + 2] = THREE.MathUtils.lerp(vz, sz / nbrs.size, factor)
    }
    current = next
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(current, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

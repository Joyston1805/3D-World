import * as THREE from 'three'
import { triTable as triTableMistyped } from 'three-stdlib'

// three-stdlib's .d.ts declares this as Int32Array[], but it's actually a flat,
// pre-packed Int32Array of length 256*16 (verified at runtime) — the same table
// three.js's own MarchingCubes object indexes as `triTable[cubeindex*16 + i]`.
const triTable = triTableMistyped as unknown as Int32Array

/**
 * A scalar field sampled on a regular grid. data[x + y*nx + z*nx*ny] is the field value
 * at grid point (x,y,z); world position = origin + (x*cellSize.x, y*cellSize.y, z*cellSize.z).
 */
export interface ScalarGrid {
  nx: number
  ny: number
  nz: number
  origin: THREE.Vector3
  cellSize: THREE.Vector3
  data: Float32Array
}

// Classic (Bourke/Bloyd) marching-cubes cube-corner convention, reusing three-stdlib's
// triTable (the same 256x16 case table used by three.js's own MarchingCubes object) —
// corner order and edge numbering must match exactly what that table was built for.
const CORNER_OFFSET: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
]
const CORNER_BIT = [1, 2, 8, 4, 16, 32, 128, 64]
const EDGE_CORNERS: [number, number][] = [
  [0, 1],
  [1, 3],
  [2, 3],
  [0, 2],
  [4, 5],
  [5, 7],
  [6, 7],
  [4, 6],
  [0, 4],
  [1, 5],
  [3, 7],
  [2, 6],
]

/**
 * Surface where the field crosses isoLevel, with field >= isoLevel treated as "inside"
 * (matching the sign convention three-stdlib's triTable was generated for, which is what
 * gives correctly outward-facing/printable triangle winding for free).
 *
 * Vertices are welded by grid-edge identity (not per-cube), so every internal edge is
 * shared by exactly two triangles — a genuinely indexed, watertight mesh, not a
 * position-duplicated one.
 */
export function marchingCubes(grid: ScalarGrid, isoLevel: number): THREE.BufferGeometry {
  const { nx, ny, nz, data, origin, cellSize } = grid
  const at = (x: number, y: number, z: number) => data[x + y * nx + z * nx * ny]

  const gA = new THREE.Vector3()
  const gB = new THREE.Vector3()
  const gradientAt = (x: number, y: number, z: number, out: THREE.Vector3) => {
    const xm = Math.max(0, x - 1)
    const xp = Math.min(nx - 1, x + 1)
    const ym = Math.max(0, y - 1)
    const yp = Math.min(ny - 1, y + 1)
    const zm = Math.max(0, z - 1)
    const zp = Math.min(nz - 1, z + 1)
    out.set(at(xm, y, z) - at(xp, y, z), at(x, ym, z) - at(x, yp, z), at(x, y, zm) - at(x, y, zp))
  }

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const vertexCache = new Map<string, number>()

  function getOrCreateVertex(ax: number, ay: number, az: number, bx: number, by: number, bz: number, mu: number): number {
    const ia = ax + ay * nx + az * nx * ny
    const ib = bx + by * nx + bz * nx * ny
    const key = ia < ib ? `${ia}_${ib}` : `${ib}_${ia}`
    const cached = vertexCache.get(key)
    if (cached !== undefined) return cached

    const px = THREE.MathUtils.lerp(origin.x + ax * cellSize.x, origin.x + bx * cellSize.x, mu)
    const py = THREE.MathUtils.lerp(origin.y + ay * cellSize.y, origin.y + by * cellSize.y, mu)
    const pz = THREE.MathUtils.lerp(origin.z + az * cellSize.z, origin.z + bz * cellSize.z, mu)
    gradientAt(ax, ay, az, gA)
    gradientAt(bx, by, bz, gB)

    const index = positions.length / 3
    positions.push(px, py, pz)
    normals.push(THREE.MathUtils.lerp(gA.x, gB.x, mu), THREE.MathUtils.lerp(gA.y, gB.y, mu), THREE.MathUtils.lerp(gA.z, gB.z, mu))
    vertexCache.set(key, index)
    return index
  }

  const values = new Float32Array(8)
  const edgeVertex = new Array<number | undefined>(12)

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        let cubeindex = 0
        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = CORNER_OFFSET[c]
          const v = at(x + dx, y + dy, z + dz)
          values[c] = v
          if (v < isoLevel) cubeindex |= CORNER_BIT[c]
        }
        if (cubeindex === 0 || cubeindex === 255) continue

        edgeVertex.fill(undefined)
        const base = cubeindex * 16
        for (let i = 0; i < 16; i++) {
          const e = triTable[base + i]
          if (e === -1) break
          if (edgeVertex[e] === undefined) {
            const [c0, c1] = EDGE_CORNERS[e]
            const [ax, ay, az] = CORNER_OFFSET[c0]
            const [bx, by, bz] = CORNER_OFFSET[c1]
            const v0 = values[c0]
            const v1 = values[c1]
            const mu = Math.abs(v1 - v0) < 1e-9 ? 0.5 : (isoLevel - v0) / (v1 - v0)
            edgeVertex[e] = getOrCreateVertex(x + ax, y + ay, z + az, x + bx, y + by, z + bz, mu)
          }
        }
        for (let i = 0; triTable[base + i] !== -1; i += 3) {
          indices.push(edgeVertex[triTable[base + i]]!, edgeVertex[triTable[base + i + 1]]!, edgeVertex[triTable[base + i + 2]]!)
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.normalizeNormals()
  geometry.computeBoundingBox()
  return geometry
}

import * as fs from 'node:fs'
import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'
import { shapeCatalog } from '../src/shapes/catalog'
import { defaultValuesFor } from '../src/engine/types'

function posKey(x: number, y: number, z: number): string {
  // Position-based (not index-based) so this also validates non-indexed
  // (flat-shaded / merged multi-mesh) geometry, where coincident vertices
  // don't share an index. 1e-4mm is well below print resolution.
  // Round to the key's own precision *then* normalize -0 to 0 — toFixed
  // keeps the sign on negative-zero-ish values (e.g. -0.00001 -> "-0.0000"),
  // which would otherwise split one real vertex into two different keys.
  const round = (v: number) => {
    const r = Math.round(v * 10000) / 10000
    return r === 0 ? 0 : r
  }
  return `${round(x).toFixed(4)}_${round(y).toFixed(4)}_${round(z).toFixed(4)}`
}

for (const shape of shapeCatalog) {
  const values = defaultValuesFor(shape.params)
  const geometry = shape.build(values)
  const pos = geometry.getAttribute('position')
  const index = geometry.getIndex()
  let nanCount = 0
  for (let i = 0; i < pos.count; i++) {
    if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) nanCount++
  }
  const triCount = index ? index.count / 3 : pos.count / 3
  const vertIndex = (t: number, corner: number) => (index ? index.getX(t * 3 + corner) : t * 3 + corner)

  // Edge-manifold check (position-keyed): every edge should be shared by
  // exactly 2 triangles, which is the definition of a closed/watertight mesh
  // (or, for a union of separately-closed solids like the branch generator,
  // holds independently within each solid).
  const edgeMap = new Map<string, number>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let degenerate = 0
  for (let t = 0; t < triCount; t++) {
    const i0 = vertIndex(t, 0)
    const i1 = vertIndex(t, 1)
    const i2 = vertIndex(t, 2)
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2
    if (area < 1e-9) degenerate++
    const k0 = posKey(a.x, a.y, a.z)
    const k1 = posKey(b.x, b.y, b.z)
    const k2 = posKey(c.x, c.y, c.z)
    const edges: [string, string][] = [
      [k0, k1],
      [k1, k2],
      [k2, k0],
    ]
    for (const [x, y] of edges) {
      const key = x < y ? `${x}|${y}` : `${y}|${x}`
      edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
    }
  }
  let nonManifoldEdges = 0
  for (const count of edgeMap.values()) {
    if (count !== 2) nonManifoldEdges++
  }

  const mesh = new THREE.Mesh(geometry)
  const exporter = new STLExporter()
  const result = exporter.parse(mesh, { binary: true }) as unknown as DataView
  const buf = Buffer.from(result.buffer as ArrayBuffer)
  const triCountFromHeader = buf.readUInt32LE(80)

  fs.mkdirSync('scripts/out', { recursive: true })
  fs.writeFileSync(`scripts/out/${shape.id}.stl`, buf)

  console.log(
    `${shape.id}: verts=${pos.count} tris=${triCount} nan=${nanCount} degenerate=${degenerate} nonManifoldEdges=${nonManifoldEdges} stlHeaderTris=${triCountFromHeader} stlBytes=${buf.length}`,
  )
}

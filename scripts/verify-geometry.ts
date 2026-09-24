import * as fs from 'node:fs'
import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'
import { shapeCatalog, templatesByShapeId } from '../src/shapes/catalog'
import { defaultValuesFor } from '../src/engine/types'
import type { ParamValues } from '../src/engine/types'
import { ensureManifoldLoading } from '../src/engine/manifoldSingleton'

// Perforated shapes need the manifold-3d WASM module for their CSG step; without
// this, applyPerforation() silently skips perforation (the same graceful-degradation
// the browser uses while it loads) and this script would never exercise that path.
await ensureManifoldLoading()

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

function verify(label: string, geometry: THREE.BufferGeometry) {
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
  fs.writeFileSync(`scripts/out/${label}.stl`, buf)

  console.log(
    `${label}: verts=${pos.count} tris=${triCount} nan=${nanCount} degenerate=${degenerate} nonManifoldEdges=${nonManifoldEdges} stlHeaderTris=${triCountFromHeader} stlBytes=${buf.length}`,
  )
}

for (const shape of shapeCatalog) {
  const defaults = defaultValuesFor(shape.params)
  verify(`${shape.id}-defaults`, shape.build(defaults))

  const templates = templatesByShapeId[shape.id] ?? []
  for (const t of templates) {
    const values: ParamValues = { ...defaults, ...t.values }
    verify(`${shape.id}--${t.id}`, shape.build(values))
  }
}

// ---- City map (real footprints) with synthetic footprints, incl. a concave L-shape,
// a self-intersecting bow-tie (must be skipped), and a building hanging off the edge. ----
{
  const { encodeFootprints } = await import('../src/engine/cityGeometry')
  const { cityMap } = await import('../src/shapes/cityShapes')
  const footprints = encodeFootprints([
    { heightM: 80, points: [[0.2, 0.2], [0.4, 0.2], [0.4, 0.3], [0.3, 0.3], [0.3, 0.5], [0.2, 0.5]] }, // L-shape
    { heightM: 30, points: [[0.6, 0.6], [0.7, 0.6], [0.7, 0.7], [0.6, 0.7]] },
    { heightM: 200, points: [[0.8, 0.1], [0.9, 0.2], [0.9, 0.1], [0.8, 0.2]] }, // bow-tie -> skipped
    { heightM: 50, points: [[0.95, 0.95], [1.1, 0.95], [1.1, 1.1], [0.95, 1.1]] }, // clamped to plate edge
  ])
  const values: ParamValues = { ...defaultValuesFor(cityMap.params), footprints }
  verify('citymap-synthetic', cityMap.build(values))
}

// ---- 3MF round trip: one object per color, triangle counts preserved. ----
{
  const { build3mf } = await import('../src/lib/exportStl')
  const { unzipSync, strFromU8 } = await import('fflate')
  const { cityscape, cityscapeTemplates } = await import('../src/shapes/cityShapes')
  const t = cityscapeTemplates.find((x) => x.id === 'downtown')!
  const values: ParamValues = { ...defaultValuesFor(cityscape.params), ...t.values }
  const geo = cityscape.build(values)
  const bytes = build3mf(geo, true, 'verify')
  fs.writeFileSync('scripts/out/cityscape-downtown.3mf', bytes)
  const model = strFromU8(unzipSync(bytes)['3D/3dmodel.model'])
  const objects = (model.match(/<object /g) ?? []).length
  const tris = (model.match(/<triangle /g) ?? []).length
  const srcTris = geo.getAttribute('position').count / 3
  console.log(`3mf: objects=${objects} triangles=${tris} sourceTriangles=${srcTris} ${tris === srcTris ? 'OK' : 'MISMATCH'}`)
  if (tris !== srcTris || objects < 2) process.exitCode = 1
}

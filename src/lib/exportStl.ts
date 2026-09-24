import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'
import { zipSync, strToU8 } from 'fflate'

const exporter = new STLExporter()

/**
 * Slicers (Bambu Studio included) are Z-up. Shapes built Y-up (vases, blobs, coral, AI
 * models) are rotated onto Z here at export time; Z-up shapes (panels, city) pass
 * through. Either way the result sits on the bed (min Z = 0), centered on X/Y.
 */
export function orientForPrint(geometry: THREE.BufferGeometry, zUp: boolean): THREE.BufferGeometry {
  const geo = geometry.clone()
  if (!zUp) geo.rotateX(Math.PI / 2)
  geo.computeBoundingBox()
  const box = geo.boundingBox
  if (box) geo.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z)
  return geo
}

function save(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadStl(geometry: THREE.BufferGeometry, zUp: boolean, filename: string) {
  const result = exporter.parse(new THREE.Mesh(orientForPrint(geometry, zUp)), { binary: true }) as unknown as DataView
  save(result.buffer as ArrayBuffer, filename.endsWith('.stl') ? filename : `${filename}.stl`, 'application/octet-stream')
}

export function hasVertexColors(geometry: THREE.BufferGeometry): boolean {
  return geometry.hasAttribute('color')
}

/** Distinct colors in the geometry (by first vertex of each triangle), as sRGB hex. */
export function countColors(geometry: THREE.BufferGeometry): number {
  return splitByColor(geometry).length
}

interface ColorGroup {
  hex: string
  positions: number[]
}

function splitByColor(geometry: THREE.BufferGeometry): ColorGroup[] {
  const pos = geometry.getAttribute('position')
  const col = geometry.getAttribute('color')
  const index = geometry.getIndex()
  const triCount = index ? index.count / 3 : pos.count / 3
  const groups = new Map<string, ColorGroup>()
  const tmp = new THREE.Color()
  for (let t = 0; t < triCount; t++) {
    const v = [0, 1, 2].map((c) => (index ? index.getX(t * 3 + c) : t * 3 + c))
    tmp.setRGB(col.getX(v[0]), col.getY(v[0]), col.getZ(v[0]))
    const hex = tmp.getHexString()
    let g = groups.get(hex)
    if (!g) {
      g = { hex, positions: [] }
      groups.set(hex, g)
    }
    for (const i of v) g.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
  }
  return [...groups.values()]
}

const fmt = (n: number) => (Math.round(n * 10000) / 10000).toString()

function objectXml(id: number, name: string, materialIndex: number, group: ColorGroup): string {
  const vertIndex = new Map<string, number>()
  const verts: string[] = []
  const tris: string[] = []
  const p = group.positions
  for (let i = 0; i < p.length; i += 9) {
    const ids: number[] = []
    for (let c = 0; c < 3; c++) {
      const x = fmt(p[i + c * 3])
      const y = fmt(p[i + c * 3 + 1])
      const z = fmt(p[i + c * 3 + 2])
      const key = `${x} ${y} ${z}`
      let vi = vertIndex.get(key)
      if (vi === undefined) {
        vi = verts.length
        vertIndex.set(key, vi)
        verts.push(`<vertex x="${x}" y="${y}" z="${z}"/>`)
      }
      ids.push(vi)
    }
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue
    tris.push(`<triangle v1="${ids[0]}" v2="${ids[1]}" v3="${ids[2]}"/>`)
  }
  return `<object id="${id}" type="model" name="${name}" pid="1" pindex="${materialIndex}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`
}

/**
 * Multi-color 3MF: one object per distinct color, each tagged with its color as a
 * base material. Slicers open these as separate parts (in Bambu Studio: select them
 * all and use "Assemble", then assign a filament to each part).
 */
export function build3mf(geometry: THREE.BufferGeometry, zUp: boolean, baseName: string): Uint8Array {
  const oriented = orientForPrint(geometry, zUp)
  const groups = splitByColor(oriented)
  const materials = groups
    .map((g, i) => `<base name="Color ${i + 1}" displaycolor="#${g.hex.toUpperCase()}FF"/>`)
    .join('')
  const objects = groups.map((g, i) => objectXml(i + 2, `${baseName} color ${i + 1}`, i, g)).join('')
  const items = groups.map((_, i) => `<item objectid="${i + 2}"/>`).join('')
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><basematerials id="1">${materials}</basematerials>${objects}</resources><build>${items}</build></model>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model),
  })
}

export function download3mf(geometry: THREE.BufferGeometry, zUp: boolean, filename: string) {
  const bytes = build3mf(geometry, zUp, filename.replace(/\.3mf$/, ''))
  save(bytes as BlobPart, filename.endsWith('.3mf') ? filename : `${filename}.3mf`, 'model/3mf')
}

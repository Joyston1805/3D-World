import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'

const exporter = new STLExporter()

export function downloadStl(mesh: THREE.Object3D, filename: string) {
  const result = exporter.parse(mesh, { binary: true }) as unknown as DataView
  const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.stl') ? filename : `${filename}.stl`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

import * as THREE from 'three'
import { sampleHeightmap } from '../lib/imageToHeightmap'
import type { Heightmap } from './types'

/**
 * A flat image-relief panel ("lithophane"): thickness varies per-pixel with image
 * brightness (dark = thick, light = thin), so backlighting reveals the picture in
 * grayscale. Built the same way as every other shape in this app — a front relief
 * surface + a flat back plane, sealed by a perimeter rim into one watertight solid.
 *
 * All units are millimeters (1 scene unit = 1mm) to match slicer expectations.
 */

export interface LithophanePanelParams {
  heightmap: Heightmap
  widthMm: number
  heightMm: number
  minThickness: number
  maxThickness: number
  invert: boolean
  /** Grid resolution along each axis; higher = more detail, more triangles. */
  resolution: number
}

function addRimStrip(
  indices: number[],
  frontRow: number[],
  backRow: number[],
  reversed: boolean,
) {
  for (let k = 0; k < frontRow.length - 1; k++) {
    const fA = frontRow[k]
    const fB = frontRow[k + 1]
    const bA = backRow[k]
    const bB = backRow[k + 1]
    if (!reversed) {
      indices.push(fA, fB, bA, fB, bB, bA)
    } else {
      indices.push(fA, bA, fB, fB, bA, bB)
    }
  }
}

export function buildLithophanePanel(p: LithophanePanelParams): THREE.BufferGeometry {
  const cols = Math.max(2, Math.round(p.resolution))
  const aspect = p.heightMm / p.widthMm
  const rows = Math.max(2, Math.round(p.resolution * aspect))
  const wall = Math.max(0.1, p.maxThickness - p.minThickness)

  const positions: number[] = []
  const indices: number[] = []
  const pushVert = (x: number, y: number, z: number): number => {
    positions.push(x, y, z)
    return positions.length / 3 - 1
  }

  const front: number[][] = []
  const back: number[][] = []
  for (let i = 0; i < rows; i++) {
    const v = i / (rows - 1)
    const y = (0.5 - v) * p.heightMm
    const frontRow: number[] = []
    const backRow: number[] = []
    for (let j = 0; j < cols; j++) {
      const u = j / (cols - 1)
      const x = (u - 0.5) * p.widthMm
      let brightness = sampleHeightmap(p.heightmap, u, v)
      if (p.invert) brightness = 1 - brightness
      const thickness = p.minThickness + (1 - brightness) * wall
      frontRow.push(pushVert(x, y, thickness))
      backRow.push(pushVert(x, y, 0))
    }
    front.push(frontRow)
    back.push(backRow)
  }

  // Front relief surface: outward normal +Z, winding (a,c,b) + (a,d,c).
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = front[i][j]
      const b = front[i][j + 1]
      const c = front[i + 1][j + 1]
      const d = front[i + 1][j]
      indices.push(a, c, b, a, d, c)
    }
  }
  // Flat back plane: outward normal -Z, reversed winding.
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = back[i][j]
      const b = back[i][j + 1]
      const c = back[i + 1][j + 1]
      const d = back[i + 1][j]
      indices.push(a, b, c, a, c, d)
    }
  }

  // Perimeter rim seals front to back. Derived winding: the (frontA,frontB,backA)
  // pattern (with j/i increasing) gives +Y on a top-style edge and +X on a
  // right-style edge; the reversed pattern gives the opposite two.
  addRimStrip(indices, front[0], back[0], false) // top edge, +Y
  addRimStrip(indices, front[rows - 1], back[rows - 1], true) // bottom edge, -Y
  addRimStrip(
    indices,
    front.map((row) => row[cols - 1]),
    back.map((row) => row[cols - 1]),
    false,
  ) // right edge, +X
  addRimStrip(
    indices,
    front.map((row) => row[0]),
    back.map((row) => row[0]),
    true,
  ) // left edge, -X

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

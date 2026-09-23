import * as THREE from 'three'

/**
 * Generic flat relief panel builder: a front surface whose height varies per (u,v)
 * position, sealed to a flat back plane by a perimeter rim into one watertight solid.
 * Shared by the Photo Panel (lithophane, thickness from image brightness) and the
 * Terrain Map (thickness from real elevation data) — same topology, different height
 * source.
 *
 * All units are millimeters (1 scene unit = 1mm) to match slicer expectations.
 */

export interface ReliefPanelParams {
  widthMm: number
  heightMm: number
  /** Grid resolution along each axis; higher = more detail, more triangles. */
  resolution: number
  /** Panel thickness (mm) at normalized (u, v) in [0,1]x[0,1] — u=0 is left, v=0 is top. */
  thicknessAt: (u: number, v: number) => number
}

function addRimStrip(indices: number[], frontRow: number[], backRow: number[], reversed: boolean) {
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

export function buildReliefPanel(p: ReliefPanelParams): THREE.BufferGeometry {
  const cols = Math.max(2, Math.round(p.resolution))
  const aspect = p.heightMm / p.widthMm
  const rows = Math.max(2, Math.round(p.resolution * aspect))

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
      const thickness = Math.max(0.05, p.thicknessAt(u, v))
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

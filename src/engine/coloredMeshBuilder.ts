import * as THREE from 'three'

/**
 * Accumulates closed prisms (a 2D outline extruded between two Z heights) into one
 * non-indexed BufferGeometry with a per-vertex `color` attribute. Every prism is its
 * own closed watertight shell in a single uniform color, which is what lets the
 * multi-color 3MF exporter split the mesh cleanly by color (see lib/export3mf.ts).
 *
 * Z-up, millimeters. Each shell is individually manifold; shells that touch or
 * overlap (a tower on a plate) are unioned by the slicer at print time.
 */
export class ColoredMeshBuilder {
  private positions: number[] = []
  private colors: number[] = []
  triangleCount = 0

  private pushTri(a: number[], b: number[], c: number[], color: THREE.Color) {
    this.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
    for (let i = 0; i < 3; i++) this.colors.push(color.r, color.g, color.b)
    this.triangleCount++
  }

  /** `outline` must be a simple (non-self-intersecting) polygon; either winding is accepted. */
  addPrism(outline: [number, number][], z0: number, z1: number, color: THREE.Color) {
    const pts = outline.map(([x, y]) => new THREE.Vector2(x, y))
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse()
    const n = pts.length
    if (n < 3 || z1 <= z0) return

    // Side walls (outline is CCW, so outward is to the right of each edge).
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      const a0 = [a.x, a.y, z0]
      const b0 = [b.x, b.y, z0]
      const b1 = [b.x, b.y, z1]
      const a1 = [a.x, a.y, z1]
      this.pushTri(a0, b0, b1, color)
      this.pushTri(a0, b1, a1, color)
    }

    // Caps: triangulate once, then emit CCW on top and CW on the bottom.
    const tris = THREE.ShapeUtils.triangulateShape(pts, [])
    for (const [i, j, k] of tris) {
      const p = pts[i]
      let q = pts[j]
      let r = pts[k]
      const area2 = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
      if (area2 < 0) [q, r] = [r, q]
      this.pushTri([p.x, p.y, z1], [q.x, q.y, z1], [r.x, r.y, z1], color)
      this.pushTri([p.x, p.y, z0], [r.x, r.y, z0], [q.x, q.y, z0], color)
    }
  }

  addBox(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: THREE.Color) {
    this.addPrism(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      z0,
      z1,
      color,
    )
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    geometry.computeVertexNormals()
    return geometry
  }
}

/** Regular N-gon approximating a circle, for round plates. */
export function circleOutline(radius: number, segments = 72): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push([radius * Math.cos(a), radius * Math.sin(a)])
  }
  return pts
}

/** True if no two non-adjacent edges of the closed polygon cross. O(n^2); fine for building outlines. */
export function isSimplePolygon(pts: [number, number][]): boolean {
  const n = pts.length
  if (n < 3) return false
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      const c = pts[j]
      const d = pts[(j + 1) % n]
      const d1 = ccw(a, b, c)
      const d2 = ccw(a, b, d)
      const d3 = ccw(c, d, a)
      const d4 = ccw(c, d, b)
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return false
    }
  }
  return true
}

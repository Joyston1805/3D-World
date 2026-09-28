import * as THREE from 'three'
import { marchingCubes } from '../lib/marchingCubes'

/**
 * Reconstructs a solid from silhouettes shot around it — a classic "visual hull" /
 * shape-from-silhouette carve: a point is kept only if it falls inside every view's
 * silhouette. Fully local (no AI, no network) — the tradeoff is that concavities not
 * visible in any silhouette (an eye socket, the inside of a cup) can't be recovered;
 * see the README for what this technique can and can't do.
 *
 * There's no real camera calibration (no structure-from-motion) — every view uses the
 * same idealized orbiting camera (fixed distance/FOV, elevation you set, azimuth you
 * assign per view), which is why views need roughly even spacing and a centered,
 * consistently-framed subject to carve cleanly.
 */

export interface HullView {
  /** width*height, 1 = foreground (part of the object), 0 = background. */
  mask: Float32Array
  width: number
  height: number
  azimuthDeg: number
}

export interface VisualHullParams {
  views: HullView[]
  /** Degrees above the horizon the camera looks from (matches how the photos/video were shot). */
  elevationDeg: number
  /** Voxels along the shorter (X/Z) axes. */
  resolution: number
  /** Height of the reconstruction volume relative to its width. */
  aspect: number
}

const CAMERA_DISTANCE = 3
const FOV_DEG = 35
const HALF_EXTENT = 0.8
const ISO_LEVEL = 0.5

function bilinearSample(mask: Float32Array, w: number, h: number, u: number, v: number): number {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0
  const fx = u * (w - 1)
  const fy = v * (h - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const s = (x: number, y: number) => mask[y * w + x]
  return s(x0, y0) * (1 - tx) * (1 - ty) + s(x1, y0) * tx * (1 - ty) + s(x0, y1) * (1 - tx) * ty + s(x1, y1) * tx * ty
}

function makeCamera(view: HullView, elevationDeg: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(FOV_DEG, view.width / view.height, 0.01, CAMERA_DISTANCE * 4)
  const az = THREE.MathUtils.degToRad(view.azimuthDeg)
  const el = THREE.MathUtils.degToRad(elevationDeg)
  camera.position.set(
    CAMERA_DISTANCE * Math.cos(el) * Math.sin(az),
    CAMERA_DISTANCE * Math.sin(el),
    CAMERA_DISTANCE * Math.cos(el) * Math.cos(az),
  )
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

function zeroBorder(field: Float32Array, nx: number, ny: number, nz: number) {
  const idx = (x: number, y: number, z: number) => x + y * nx + z * nx * ny
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        if (x === 0 || x === nx - 1 || y === 0 || y === ny - 1 || z === 0 || z === nz - 1) field[idx(x, y, z)] = 0
      }
    }
  }
}

export function carveVisualHull(p: VisualHullParams): THREE.BufferGeometry {
  if (p.views.length < 2) throw new Error('Need at least 2 views to carve a shape.')
  const nx = Math.max(8, Math.round(p.resolution))
  const nz = nx
  const ny = Math.max(8, Math.round(p.resolution * p.aspect))
  const halfY = HALF_EXTENT * p.aspect

  const cameras = p.views.map((view) => ({ view, camera: makeCamera(view, p.elevationDeg) }))
  const field = new Float32Array(nx * ny * nz)
  const point = new THREE.Vector3()

  for (let iz = 0; iz < nz; iz++) {
    const wz = -HALF_EXTENT + (iz / (nz - 1)) * 2 * HALF_EXTENT
    for (let iy = 0; iy < ny; iy++) {
      const wy = -halfY + (iy / (ny - 1)) * 2 * halfY
      for (let ix = 0; ix < nx; ix++) {
        const wx = -HALF_EXTENT + (ix / (nx - 1)) * 2 * HALF_EXTENT
        point.set(wx, wy, wz)
        let score = 1
        for (const { view, camera } of cameras) {
          const proj = point.clone().project(camera)
          if (proj.z < -1 || proj.z > 1) {
            score = 0
            break
          }
          const u = (proj.x + 1) / 2
          const v = (1 - proj.y) / 2
          const s = bilinearSample(view.mask, view.width, view.height, u, v)
          if (s < score) score = s
          if (score === 0) break
        }
        field[ix + iy * nx + iz * nx * ny] = score
      }
    }
  }

  // Guarantees a closed surface even if a photo is framed with no margin around the
  // object (which would otherwise let the hull touch the grid boundary and leave a hole).
  zeroBorder(field, nx, ny, nz)

  return marchingCubes(
    {
      nx,
      ny,
      nz,
      origin: new THREE.Vector3(-HALF_EXTENT, -halfY, -HALF_EXTENT),
      cellSize: new THREE.Vector3((2 * HALF_EXTENT) / (nx - 1), (2 * halfY) / (ny - 1), (2 * HALF_EXTENT) / (nz - 1)),
      data: field,
    },
    ISO_LEVEL,
  )
}

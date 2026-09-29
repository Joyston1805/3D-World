/**
 * Turns a photo of an object into a foreground/background silhouette mask, entirely
 * locally (no AI): estimate the background color from the image border, then flood-fill
 * inward from the border through pixels close to that color. A pixel only becomes
 * "background" by being *reachable from the border* through such pixels — so a
 * same-colored patch inside the object (e.g. a white shirt on a white backdrop, as long
 * as it doesn't touch the frame edge) stays foreground. Works best with a plain, fairly
 * even backdrop; a cluttered background will need a tighter tolerance or won't segment
 * cleanly at all.
 */

export interface SilhouetteMask {
  data: Float32Array
  width: number
  height: number
}

const WORK_SIZE = 220

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

/**
 * Separable box blur, in place. Softens the mask's hard 0/1 edge into a gradient a few
 * pixels wide, so the visual hull's carved field varies smoothly across several voxels
 * instead of snapping at a single pixel boundary — this is what keeps the marching-cubes
 * output from looking like a blocky voxel stack. (An earlier attempt at this was reverted
 * after an ad-hoc test appeared to show it introduced non-manifold edges; that test's
 * check turned out to be a false positive — see scripts/verify-geometry.ts's posKey
 * comment — and a permanent regression test now covers this exact blurred-mask case.)
 */
export function boxBlur(data: Float32Array, width: number, height: number, radius: number, passes: number) {
  let src = data
  for (let p = 0; p < passes; p++) {
    const horizontal = new Float32Array(src.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += src[y * width + xx]
          count++
        }
        horizontal[y * width + x] = sum / count
      }
    }
    const both = new Float32Array(src.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= height) continue
          sum += horizontal[yy * width + x]
          count++
        }
        both[y * width + x] = sum / count
      }
    }
    src = both
  }
  data.set(src)
}

function drawScaled(image: CanvasImageSource, sourceWidth: number, sourceHeight: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = WORK_SIZE / Math.max(sourceWidth, sourceHeight)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height)
  return { canvas, width, height }
}

/** tolerance: 0-441 (max possible RGB distance is ~441); typical useful range ~20-100. */
export function extractSilhouette(image: CanvasImageSource, sourceWidth: number, sourceHeight: number, tolerance: number): SilhouetteMask {
  const { canvas, width, height } = drawScaled(image, sourceWidth, sourceHeight)
  const ctx = canvas.getContext('2d')!
  const { data: px } = ctx.getImageData(0, 0, width, height)

  let br = 0
  let bg = 0
  let bb = 0
  let n = 0
  const addBorder = (x: number, y: number) => {
    const i = (y * width + x) * 4
    br += px[i]
    bg += px[i + 1]
    bb += px[i + 2]
    n++
  }
  for (let x = 0; x < width; x++) {
    addBorder(x, 0)
    addBorder(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    addBorder(0, y)
    addBorder(width - 1, y)
  }
  br /= n
  bg /= n
  bb /= n

  const isBg = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const stack: number[] = []
  const tryClassify = (idx: number) => {
    if (visited[idx]) return
    visited[idx] = 1
    const i = idx * 4
    if (colorDistance(px[i], px[i + 1], px[i + 2], br, bg, bb) <= tolerance) {
      isBg[idx] = 1
      stack.push(idx)
    }
  }
  for (let x = 0; x < width; x++) {
    tryClassify(x)
    tryClassify((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    tryClassify(y * width)
    tryClassify(y * width + width - 1)
  }

  while (stack.length > 0) {
    const idx = stack.pop() as number
    const x = idx % width
    const y = (idx / width) | 0
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nIdx = ny * width + nx
      if (visited[nIdx]) continue
      visited[nIdx] = 1
      const i = nIdx * 4
      if (colorDistance(px[i], px[i + 1], px[i + 2], br, bg, bb) <= tolerance) {
        isBg[nIdx] = 1
        stack.push(nIdx)
      }
    }
  }

  const data = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) data[i] = isBg[i] ? 0 : 1
  boxBlur(data, width, height, 2, 2)
  return { data, width, height }
}

/** A preview image (data URL) with background pixels tinted red, so tolerance is easy to judge. */
export function renderMaskPreview(image: CanvasImageSource, sourceWidth: number, sourceHeight: number, mask: SilhouetteMask): string {
  const { canvas, width, height } = drawScaled(image, sourceWidth, sourceHeight)
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, width, height)
  const px = imgData.data
  for (let i = 0; i < width * height; i++) {
    if (mask.data[i] < 0.5) {
      px[i * 4] = Math.round(px[i * 4] * 0.5 + 255 * 0.5)
      px[i * 4 + 1] = Math.round(px[i * 4 + 1] * 0.5)
      px[i * 4 + 2] = Math.round(px[i * 4 + 2] * 0.5)
      px[i * 4 + 3] = 180
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/png')
}

import type { Heightmap } from '../engine/types'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not decode the selected file as an image.'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Samples an uploaded image down to a grayscale brightness grid, sized to exactly
 * match the image's own aspect ratio (rows derived from cols) — no cropping, so the
 * caller can drive a panel's height from `aspect` and never distort the picture.
 */
export async function loadImageAsHeightmap(file: File, cols: number): Promise<Heightmap & { aspect: number }> {
  const img = await loadImage(file)
  const aspect = img.height / img.width
  const rows = Math.max(2, Math.round(cols * aspect))

  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  ctx.drawImage(img, 0, 0, cols, rows)

  const pixels = ctx.getImageData(0, 0, cols, rows).data
  const data = new Float32Array(cols * rows)
  for (let i = 0; i < cols * rows; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    data[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255
  }
  return { data, cols, rows, aspect }
}

/** Bilinear sample at normalized (u, v) in [0, 1]. */
export function sampleHeightmap(hm: Heightmap, u: number, v: number): number {
  const x = Math.min(hm.cols - 1, Math.max(0, u * (hm.cols - 1)))
  const y = Math.min(hm.rows - 1, Math.max(0, v * (hm.rows - 1)))
  const x0 = Math.floor(x)
  const x1 = Math.min(hm.cols - 1, x0 + 1)
  const y0 = Math.floor(y)
  const y1 = Math.min(hm.rows - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const at = (xx: number, yy: number) => hm.data[yy * hm.cols + xx]
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}

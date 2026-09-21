import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SKETCH_PROFILE } from '../shapes/revolveShapes'

const SAMPLES = 48
const CANVAS_W = 260
const CANVAS_H = 320

interface SketchPadProps {
  value: number[]
  onChange: (profile: number[]) => void
}

/** Row index (0=bottom..SAMPLES-1=top) for a given canvas Y pixel. */
function rowForY(y: number): number {
  const t = 1 - Math.max(0, Math.min(1, y / CANVAS_H))
  return Math.round(t * (SAMPLES - 1))
}

function radiusForX(x: number): number {
  return Math.max(0, Math.min(1, x / CANVAS_W))
}

export function SketchPad({ value, onChange }: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const drawingRef = useRef(false)
  const lastRowRef = useRef<number | null>(null)
  const [threshold, setThreshold] = useState(140)
  const profile = value.length === SAMPLES ? value : DEFAULT_SKETCH_PROFILE

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (bgImageRef.current) {
      ctx.globalAlpha = 0.35
      ctx.drawImage(bgImageRef.current, 0, 0, CANVAS_W, CANVAS_H)
      ctx.globalAlpha = 1
    }

    // Axis line (left edge = center axis).
    ctx.strokeStyle = '#334155'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, CANVAS_H)
    ctx.stroke()
    ctx.setLineDash([])

    // Mirrored silhouette (draw actual profile on the right, mirror on the left).
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < SAMPLES; i++) {
      const y = CANVAS_H * (1 - i / (SAMPLES - 1))
      const x = profile[i] * CANVAS_W
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < SAMPLES; i++) {
      const y = CANVAS_H * (1 - i / (SAMPLES - 1))
      const x = -profile[i] * CANVAS_W
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  useEffect(redraw, [profile])

  const paintAt = (clientX: number, clientY: number, isFirst: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const row = rowForY(y)
    const radius = radiusForX(Math.abs(x))
    const next = [...profile]

    const lastRow = lastRowRef.current
    if (!isFirst && lastRow !== null && lastRow !== row) {
      const step = row > lastRow ? 1 : -1
      for (let r = lastRow; r !== row; r += step) next[r] = radius
    }
    next[row] = radius
    lastRowRef.current = row
    onChange(next)
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        bgImageRef.current = img
        // Trace: for each row, find the rightmost dark pixel starting from the
        // left (axis) edge — the standard "half-profile" silhouette convention.
        const off = document.createElement('canvas')
        off.width = CANVAS_W
        off.height = CANVAS_H
        const octx = off.getContext('2d')
        if (!octx) return
        octx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
        const data = octx.getImageData(0, 0, CANVAS_W, CANVAS_H).data
        const traced: number[] = []
        for (let i = 0; i < SAMPLES; i++) {
          const py = Math.min(CANVAS_H - 1, Math.round((1 - i / (SAMPLES - 1)) * (CANVAS_H - 1)))
          let rightmost = 0
          for (let px = 0; px < CANVAS_W; px++) {
            const idx = (py * CANVAS_W + px) * 4
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            if (brightness < threshold) rightmost = px
          }
          traced.push(radiusForX(rightmost))
        }
        onChange(traced)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs text-slate-400">
        Draw the object's side profile (left = center axis, right = wider). Or upload a photo of a
        rough sketch — a dark outline on a light background traces best.
      </p>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="cursor-crosshair self-center rounded border border-slate-700"
        onMouseDown={(e) => {
          drawingRef.current = true
          lastRowRef.current = null
          paintAt(e.clientX, e.clientY, true)
        }}
        onMouseMove={(e) => {
          if (!drawingRef.current) return
          paintAt(e.clientX, e.clientY, false)
        }}
        onMouseUp={() => {
          drawingRef.current = false
        }}
        onMouseLeave={() => {
          drawingRef.current = false
        }}
      />
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-md border border-slate-700 px-2 py-1 text-center text-xs text-slate-300 hover:bg-slate-800">
          Upload sketch photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = ''
            }}
          />
        </label>
        <button
          onClick={() => {
            bgImageRef.current = null
            onChange([...DEFAULT_SKETCH_PROFILE])
          }}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Clear
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Upload trace threshold</span>
          <span className="text-slate-500">{threshold}</span>
        </span>
        <input
          type="range"
          min={20}
          max={235}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="accent-emerald-500"
        />
      </label>
    </div>
  )
}

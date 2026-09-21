import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import { generateModelFromImage } from '../lib/aiGenerate'

const loader = new STLLoader()

interface AIGeneratePanelProps {
  onGenerated: (geometry: THREE.BufferGeometry) => void
  hasResult: boolean
  onClear: () => void
  scaleMm: number
  onScaleChange: (mm: number) => void
}

export function AIGeneratePanel({ onGenerated, hasResult, onClear, scaleMm, onScaleChange }: AIGeneratePanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFile = (f: File) => {
    setFile(f)
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const handleGenerate = async () => {
    if (!file) return
    setStatus('working')
    setError(null)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const buffer = await generateModelFromImage(file)
      const geometry = loader.parse(buffer)
      geometry.computeVertexNormals()
      geometry.computeBoundingBox()
      onGenerated(geometry)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating the model.')
      setStatus('error')
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">AI Generate (beta)</h2>
        <p className="text-xs text-slate-400">
          Upload a rough sketch or photo — an AI model (via Meshy) generates an arbitrary 3D mesh
          from it, not limited to revolve-symmetric shapes.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-300 hover:bg-slate-800">
        {previewUrl ? (
          <img src={previewUrl} alt="Selected sketch" className="max-h-40 rounded object-contain" />
        ) : (
          <span>Click to choose an image (JPG or PNG)</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </label>

      <button
        onClick={handleGenerate}
        disabled={!file || status === 'working'}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {status === 'working' ? `Generating… ${elapsed}s (can take a few minutes)` : 'Generate 3D Model'}
      </button>

      {status === 'error' && error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 p-2 text-xs text-red-300">{error}</p>
      )}

      {hasResult && (
        <>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            <span className="flex justify-between">
              <span>Scale to height</span>
              <span className="text-slate-500">{scaleMm}mm</span>
            </span>
            <input
              type="range"
              min={10}
              max={400}
              step={5}
              value={scaleMm}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </label>
          <button
            onClick={onClear}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Clear generated model
          </button>
        </>
      )}

      <p className="mt-auto text-[11px] leading-relaxed text-slate-500">
        This calls Meshy's cloud API (needs MESHY_API_KEY set on the local server — see the README).
        Unlike the parametric shapes, this output isn't guaranteed watertight/manifold — check it in
        your slicer's mesh-repair tool before printing. Scale it to a real size below once generated.
      </p>
    </div>
  )
}

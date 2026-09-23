import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import { generateModelFromImage, generateModelFromText } from '../lib/aiGenerate'

const loader = new STLLoader()
const EXAMPLE_PROMPTS = [
  'a small seated Buddha statue, hands in meditation mudra',
  'a Ganesha idol, traditional Indian style, seated pose',
  'a standing human figurine, arms at sides, neutral pose',
  'a Greek marble bust of a woman on a plinth',
]

interface AIGeneratePanelProps {
  onGenerated: (geometry: THREE.BufferGeometry) => void
  hasResult: boolean
  onClear: () => void
  scaleMm: number
  onScaleChange: (mm: number) => void
}

export function AIGeneratePanel({ onGenerated, hasResult, onClear, scaleMm, onScaleChange }: AIGeneratePanelProps) {
  const [source, setSource] = useState<'image' | 'text'>('text')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
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

  const canGenerate = source === 'image' ? !!file : prompt.trim().length > 0

  const handleGenerate = async () => {
    if (!canGenerate) return
    setStatus('working')
    setError(null)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const buffer =
        source === 'image' ? await generateModelFromImage(file as File) : await generateModelFromText(prompt.trim())
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
          Describe or photograph anything — figurines, idols, characters, arbitrary objects — and an
          AI model (via Meshy) generates a real 3D mesh, not limited to revolve-symmetric shapes.
        </p>
      </div>

      <div className="flex rounded-md border border-slate-700 p-0.5 text-xs">
        <button
          onClick={() => setSource('text')}
          className={`flex-1 rounded px-3 py-1 ${source === 'text' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          From description
        </button>
        <button
          onClick={() => setSource('image')}
          className={`flex-1 rounded px-3 py-1 ${source === 'image' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          From photo
        </button>
      </div>

      {source === 'text' ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={800}
            rows={4}
            placeholder="e.g. a small seated Buddha statue, hands in meditation mudra"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-emerald-600 hover:text-emerald-300"
              >
                {p.length > 28 ? `${p.slice(0, 28)}…` : p}
              </button>
            ))}
          </div>
        </div>
      ) : (
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
      )}

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || status === 'working'}
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

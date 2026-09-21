import { useState } from 'react'
import { loadImageAsHeightmap } from '../lib/imageToHeightmap'
import type { Heightmap } from '../engine/types'

interface ImageUploadControlProps {
  label: string
  hint?: string
  onLoaded: (heightmap: Heightmap, aspect: number) => void
}

const SAMPLE_COLS = 256

export function ImageUploadControl({ label, hint, onLoaded }: ImageUploadControlProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(file))
      const { aspect, ...heightmap } = await loadImageAsHeightmap(file, SAMPLE_COLS)
      onLoaded(heightmap, aspect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-300 hover:bg-slate-800">
        {previewUrl ? (
          <img src={previewUrl} alt="Selected" className="max-h-32 rounded object-contain" />
        ) : (
          <span>{label}</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
      </label>
      {loading && <p className="text-xs text-slate-500">Processing image…</p>}
      {error && <p className="rounded border border-red-900 bg-red-950/50 p-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}

import { useState } from 'react'
import { flattenRoute, parseGpxFile, routeBounds } from '../lib/gpx'

interface GpxUploadControlProps {
  hasRoute: boolean
  onLoaded: (flatRoute: number[], centerLat: number, centerLon: number, spanKm: number) => void
  onClear: () => void
}

export function GpxUploadControl({ hasRoute, onLoaded, onClear }: GpxUploadControlProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setStatus('loading')
    setError(null)
    try {
      const points = await parseGpxFile(file)
      const { centerLat, centerLon, spanKm } = routeBounds(points)
      onLoaded(flattenRoute(points), centerLat, centerLon, spanKm)
      setFileName(file.name)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this GPX file.')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs font-medium text-slate-200">Route (GPX)</p>
      <p className="text-xs text-slate-400">
        Upload a GPX file (from Strava, Garmin, Komoot, etc.) to trace your exact route as a raised
        line over the real terrain — location and area span auto-fit to the route.
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-slate-700 px-3 py-3 text-center text-xs text-slate-300 hover:bg-slate-800">
        <span>
          {fileName ? `Loaded: ${fileName}` : status === 'loading' ? 'Parsing…' : 'Click to upload a .gpx file'}
        </span>
        <input
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
      </label>
      {status === 'error' && error && (
        <p className="rounded border border-red-900 bg-red-950/50 p-2 text-[11px] text-red-300">{error}</p>
      )}
      {hasRoute && (
        <button
          onClick={() => {
            setFileName(null)
            onClear()
          }}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          Clear route
        </button>
      )}
    </div>
  )
}

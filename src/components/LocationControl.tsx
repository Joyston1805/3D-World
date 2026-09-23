import { useState } from 'react'
import { fetchElevationGrid } from '../lib/elevation'
import type { Heightmap } from '../engine/types'

const PRESETS = [
  { name: 'Grand Canyon', lat: 36.1069, lon: -112.1129, spanKm: 15 },
  { name: 'Half Dome, Yosemite', lat: 37.7459, lon: -119.5332, spanKm: 6 },
  { name: 'Mount Rainier', lat: 46.8523, lon: -121.7603, spanKm: 14 },
  { name: 'Zion Narrows', lat: 37.2982, lon: -112.9481, spanKm: 6 },
  { name: 'Matterhorn', lat: 45.9763, lon: 7.6586, spanKm: 8 },
]

interface LocationControlProps {
  lat: number
  lon: number
  spanKm: number
  gridResolution: number
  onLocationChange: (lat: number, lon: number, spanKm: number) => void
  onFetched: (result: { heightmap: Heightmap; minElevationM: number; maxElevationM: number }) => void
}

export function LocationControl({
  lat,
  lon,
  spanKm,
  gridResolution,
  onLocationChange,
  onFetched,
}: LocationControlProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const handleFetch = async () => {
    setStatus('loading')
    setError(null)
    setProgress(0)
    try {
      const { heightmap, minElevationM, maxElevationM } = await fetchElevationGrid(
        lat,
        lon,
        spanKm,
        gridResolution,
        setProgress,
      )
      onFetched({ heightmap, minElevationM, maxElevationM })
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch elevation data.')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs font-medium text-slate-200">Location</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onLocationChange(preset.lat, preset.lon, preset.spanKm)}
            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-emerald-600 hover:text-emerald-300"
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-slate-300">
          <span>Latitude</span>
          <input
            type="number"
            step={0.0001}
            value={lat}
            onChange={(e) => onLocationChange(Number(e.target.value), lon, spanKm)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-slate-300">
          <span>Longitude</span>
          <input
            type="number"
            step={0.0001}
            value={lon}
            onChange={(e) => onLocationChange(lat, Number(e.target.value), spanKm)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Area span</span>
          <span className="text-slate-500">{spanKm}km</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={spanKm}
          onChange={(e) => onLocationChange(lat, lon, Number(e.target.value))}
          className="accent-emerald-500"
        />
      </label>
      <button
        onClick={handleFetch}
        disabled={status === 'loading'}
        className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {status === 'loading' ? `Fetching elevation data… ${Math.round(progress * 100)}%` : 'Fetch Terrain Data'}
      </button>
      {status === 'error' && error && (
        <p className="rounded border border-red-900 bg-red-950/50 p-2 text-[11px] text-red-300">{error}</p>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Free elevation data via{' '}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline">
          Open-Meteo
        </a>{' '}
        — no account needed. Look up coordinates for a place at{' '}
        <a href="https://www.latlong.net" target="_blank" rel="noreferrer" className="underline">
          latlong.net
        </a>
        .
      </p>
    </div>
  )
}

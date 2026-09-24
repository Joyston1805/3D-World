import { useState } from 'react'
import { encodeFootprints } from '../engine/cityGeometry'
import { fetchBuildingFootprints } from '../lib/osmBuildings'

const PRESETS = [
  { name: 'Chicago Loop', lat: 41.8827, lon: -87.6233, spanKm: 0.8 },
  { name: 'Manhattan Midtown', lat: 40.7549, lon: -73.984, spanKm: 0.7 },
  { name: 'Paris, Notre-Dame', lat: 48.853, lon: 2.3499, spanKm: 0.8 },
  { name: 'London, City', lat: 51.5136, lon: -0.0887, spanKm: 0.8 },
  { name: 'Tokyo, Shibuya', lat: 35.6595, lon: 139.7005, spanKm: 0.7 },
  { name: 'San Francisco', lat: 37.7936, lon: -122.3965, spanKm: 0.8 },
  { name: 'Dubai Downtown', lat: 25.1972, lon: 55.2744, spanKm: 1.2 },
]

interface CityMapControlProps {
  lat: number
  lon: number
  spanKm: number
  buildingCount: number
  onLocationChange: (lat: number, lon: number, spanKm: number) => void
  onFetched: (footprints: number[]) => void
}

export function CityMapControl({ lat, lon, spanKm, buildingCount, onLocationChange, onFetched }: CityMapControlProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const handleFetch = async () => {
    setStatus('loading')
    setError(null)
    setNote(null)
    try {
      const { footprints, taggedHeightCount, totalFound } = await fetchBuildingFootprints(lat, lon, spanKm)
      onFetched(encodeFootprints(footprints))
      const pct = Math.round((taggedHeightCount / Math.max(1, totalFound)) * 100)
      setNote(
        `${footprints.length} buildings loaded. ${pct}% have a real height in OpenStreetMap; the rest use a default, so some areas look flatter than reality.`,
      )
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch buildings.')
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
          min={0.3}
          max={2}
          step={0.1}
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
        {status === 'loading' ? 'Fetching buildings…' : buildingCount > 0 ? 'Refetch Buildings' : 'Fetch Buildings'}
      </button>
      {status === 'error' && error && (
        <p className="rounded border border-red-900 bg-red-950/50 p-2 text-[11px] text-red-300">{error}</p>
      )}
      {note && <p className="text-[11px] leading-relaxed text-slate-400">{note}</p>}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Building data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap contributors
        </a>{' '}
        via the free Overpass API — no account needed. Keep areas small; dense downtowns can take a few seconds.
      </p>
    </div>
  )
}

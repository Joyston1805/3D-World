import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { extractSilhouette, renderMaskPreview } from '../lib/backgroundRemoval'
import { extractVideoFrames } from '../lib/videoFrames'
import { carveVisualHull } from '../engine/visualHull'
import { smoothGeometry } from '../lib/smoothMesh'

interface ViewSlot {
  id: number
  azimuthDeg: number
  source: CanvasImageSource
  width: number
  height: number
  previewUrl: string
}

let nextId = 1
const DEFAULT_SLOTS: { label: string; azimuthDeg: number }[] = [
  { label: 'Front', azimuthDeg: 0 },
  { label: 'Right', azimuthDeg: 90 },
  { label: 'Back', azimuthDeg: 180 },
  { label: 'Left', azimuthDeg: 270 },
]

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = URL.createObjectURL(file)
  })
}

interface ScanCapturePanelProps {
  onGenerated: (geometry: THREE.BufferGeometry) => void
  hasResult: boolean
  onClear: () => void
  scaleMm: number
  onScaleChange: (mm: number) => void
}

export function ScanCapturePanel({ onGenerated, hasResult, onClear, scaleMm, onScaleChange }: ScanCapturePanelProps) {
  const [mode, setMode] = useState<'photos' | 'video'>('photos')
  const [slots, setSlots] = useState<ViewSlot[]>([])
  const [tolerance, setTolerance] = useState(45)
  const [elevationDeg, setElevationDeg] = useState(10)
  const [resolution, setResolution] = useState(56)
  const [aspect, setAspect] = useState(1.3)
  const [smoothing, setSmoothing] = useState(2)
  const [frameCount, setFrameCount] = useState(12)
  const [reverseDirection, setReverseDirection] = useState(false)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultInfo, setResultInfo] = useState<string | null>(null)

  // Photo slots hold a blob URL (URL.createObjectURL) per image; each call site below
  // revokes a slot's URL as soon as it's discarded, and this is the unmount safety net
  // for whatever's left (e.g. switching away from the Scan tab mid-session). Revoking a
  // data: URL (what video-frame slots use for previewUrl) is a silent no-op, so this is
  // safe to call unconditionally without checking which kind a slot has.
  const slotsRef = useRef<ViewSlot[]>([])
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])
  useEffect(() => {
    return () => {
      for (const s of slotsRef.current) URL.revokeObjectURL(s.previewUrl)
    }
  }, [])

  const previews = useMemo(
    () =>
      slots.map((slot) => ({
        id: slot.id,
        url: renderMaskPreview(slot.source, slot.width, slot.height, extractSilhouette(slot.source, slot.width, slot.height, tolerance)),
      })),
    [slots, tolerance],
  )

  const addPhotoSlot = async (file: File, azimuthDeg: number) => {
    const img = await fileToImage(file)
    setSlots((prev) => [...prev, { id: nextId++, azimuthDeg, source: img, width: img.naturalWidth, height: img.naturalHeight, previewUrl: img.src }])
  }

  const removeSlot = (id: number) => {
    // The revoke happens here, outside the updater, because setState updater functions
    // run twice under StrictMode in development — a side effect inside one either double-
    // fires (harmless here, since re-revoking is a no-op, but still the wrong pattern) or
    // reads stale state on the discarded first pass.
    const slot = slots.find((s) => s.id === id)
    if (slot) URL.revokeObjectURL(slot.previewUrl)
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }
  const setAzimuth = (id: number, azimuthDeg: number) =>
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, azimuthDeg } : s)))
  const clearSlots = () => {
    for (const s of slots) URL.revokeObjectURL(s.previewUrl)
    setSlots([])
  }

  const handleExtractVideo = async (file: File) => {
    setStatus('working')
    setError(null)
    try {
      const frames = await extractVideoFrames(file, frameCount)
      for (const s of slots) URL.revokeObjectURL(s.previewUrl)
      const next: ViewSlot[] = frames.map((canvas, i) => {
        const raw = (i / frameCount) * 360
        return {
          id: nextId++,
          azimuthDeg: reverseDirection ? (360 - raw) % 360 : raw,
          source: canvas,
          width: canvas.width,
          height: canvas.height,
          previewUrl: canvas.toDataURL('image/jpeg', 0.7),
        }
      })
      setSlots(next)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that video.')
      setStatus('error')
    }
  }

  const handleReconstruct = () => {
    setStatus('working')
    setError(null)
    setResultInfo(null)
    // Synchronous but off the click handler's microtask via setTimeout, so the
    // "Reconstructing…" state actually paints before the (CPU-bound) carve blocks the thread.
    setTimeout(() => {
      try {
        const views = slots.map((slot) => {
          const mask = extractSilhouette(slot.source, slot.width, slot.height, tolerance)
          return { mask: mask.data, width: mask.width, height: mask.height, azimuthDeg: slot.azimuthDeg }
        })
        const geometry = carveVisualHull({ views, elevationDeg, resolution, aspect })
        const triCount = (geometry.getIndex()?.count ?? 0) / 3
        if (triCount === 0) {
          throw new Error('Nothing was carved — check that the background tolerance is separating the object from its background in the previews above.')
        }
        smoothGeometry(geometry, smoothing)
        setResultInfo(`Reconstructed ${triCount.toLocaleString()} triangles from ${slots.length} views.`)
        onGenerated(geometry)
        setStatus('idle')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reconstruct a shape from these views.')
        setStatus('error')
      }
    }, 20)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">3D Scan (beta)</h2>
        <p className="text-xs text-slate-400">
          Photograph an object from several angles (or film it turning 360°), and this carves a 3D
          shape from the silhouettes — entirely locally, no cloud API. It's a visual hull, not true
          photogrammetry: it reconstructs the outer shape well but can't recover concave detail no
          silhouette can see (an eye socket, the inside of a cup). Best for solid, roughly convex
          objects — figurines, bottles, busts — shot against a plain, fairly even background.
        </p>
      </div>

      <div className="flex rounded-md border border-slate-700 p-0.5 text-xs">
        <button
          onClick={() => setMode('photos')}
          className={`flex-1 rounded px-3 py-1 ${mode === 'photos' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          Photos
        </button>
        <button
          onClick={() => setMode('video')}
          className={`flex-1 rounded px-3 py-1 ${mode === 'video' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          360° video
        </button>
      </div>

      {mode === 'photos' ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-400">
            Shoot at evenly spaced angles around the object (front/right/back/left is the minimum;
            more angles carve a tighter, more accurate shape). Adjust each angle below if you didn't
            shoot exactly 90° apart.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-slate-700 px-3 py-3 text-center text-xs text-slate-300 hover:bg-slate-800">
            <span>Click to add a photo</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                files.forEach((f, i) => {
                  const preset = DEFAULT_SLOTS[slots.length + i]
                  void addPhotoSlot(f, preset ? preset.azimuthDeg : ((slots.length + i) * 45) % 360)
                })
                e.target.value = ''
              }}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400">
            Trim the clip to one clean 360° turn (object spinning on a turntable, or you walking
            around it at a steady pace) — frames are assumed evenly spaced around a full rotation.
          </p>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            <span className="flex justify-between">
              <span>Frames to sample</span>
              <span className="text-slate-500">{frameCount}</span>
            </span>
            <input
              type="range"
              min={6}
              max={36}
              step={1}
              value={frameCount}
              onChange={(e) => setFrameCount(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <span>Reverse rotation direction</span>
            <input
              type="checkbox"
              checked={reverseDirection}
              onChange={(e) => setReverseDirection(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-emerald-500"
            />
          </label>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-slate-700 px-3 py-3 text-center text-xs text-slate-300 hover:bg-slate-800">
            <span>{status === 'working' ? 'Extracting frames…' : 'Click to upload a 360° video'}</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleExtractVideo(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {slots.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-300">{slots.length} views</p>
            <button onClick={clearSlots} className="text-[11px] text-slate-500 hover:text-slate-300">
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {slots.map((slot, i) => (
              <div key={slot.id} className="flex flex-col gap-1 rounded-md border border-slate-700 bg-slate-900/60 p-2">
                <img
                  src={previews[i]?.url ?? slot.previewUrl}
                  alt={`View at ${slot.azimuthDeg.toFixed(0)}°`}
                  className="aspect-square w-full rounded object-cover"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={Math.round(slot.azimuthDeg)}
                    onChange={(e) => setAzimuth(slot.id, Number(e.target.value))}
                    disabled={mode === 'video'}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-100 disabled:text-slate-500"
                  />
                  <span className="text-[10px] text-slate-500">°</span>
                  {mode === 'photos' && (
                    <button onClick={() => removeSlot(slot.id)} className="shrink-0 text-[11px] text-slate-500 hover:text-red-400">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Background tolerance</span>
          <span className="text-slate-500">{tolerance}</span>
        </span>
        <input
          type="range"
          min={5}
          max={150}
          step={5}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          className="accent-emerald-500"
        />
        <span className="text-[11px] text-slate-500">
          Red areas above are what gets carved away as background. Raise this if the background
          isn't fully red; lower it if parts of the object are turning red too.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Camera elevation (how far above level the shots were taken)</span>
          <span className="text-slate-500">{elevationDeg}°</span>
        </span>
        <input
          type="range"
          min={-30}
          max={60}
          step={5}
          value={elevationDeg}
          onChange={(e) => setElevationDeg(Number(e.target.value))}
          className="accent-emerald-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span>Detail (voxel resolution)</span>
        <select
          value={resolution}
          onChange={(e) => setResolution(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
        >
          <option value={32}>Draft (fast)</option>
          <option value={56}>Standard</option>
          <option value={80}>Fine (slower)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Object aspect (height ÷ width)</span>
          <span className="text-slate-500">{aspect.toFixed(1)}</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={aspect}
          onChange={(e) => setAspect(Number(e.target.value))}
          className="accent-emerald-500"
        />
        <span className="text-[11px] text-slate-500">Taller for a bottle/figurine, lower for something squat or wide.</span>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Smoothing</span>
          <span className="text-slate-500">{smoothing}</span>
        </span>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={smoothing}
          onChange={(e) => setSmoothing(Number(e.target.value))}
          className="accent-emerald-500"
        />
        <span className="text-[11px] text-slate-500">Rounds off the voxel-grid faceting; too much washes out real detail.</span>
      </label>

      <button
        onClick={handleReconstruct}
        disabled={slots.length < 2 || status === 'working'}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {status === 'working' ? 'Reconstructing…' : `Reconstruct from ${slots.length} view${slots.length === 1 ? '' : 's'}`}
      </button>

      {status === 'error' && error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 p-2 text-xs text-red-300">{error}</p>
      )}
      {resultInfo && <p className="text-xs text-emerald-300">{resultInfo}</p>}

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
        This is a shape-from-silhouette carve (a "visual hull"), not real photogrammetry — there's no
        camera calibration, so it assumes an idealized evenly-orbiting camera at the elevation you
        set above. Like AI Generate, the output isn't guaranteed to be a perfect print-ready mesh;
        check it in your slicer before printing, and scale it once generated.
      </p>
    </div>
  )
}

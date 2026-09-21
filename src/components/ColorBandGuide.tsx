import { useState } from 'react'

interface ColorBandGuideProps {
  minThickness: number
  maxThickness: number
}

const DEFAULT_COLORS = ['#f5f0e6', '#9a9a9a', '#2a2a2a']
const PALETTE = ['#f5f0e6', '#e0824a', '#c96a4b', '#8fb7a8', '#4a6fa5', '#7a8b99', '#9a9a9a', '#2a2a2a']

/**
 * A stepped-color layer guide for opaque (non-backlit) multi-filament prints on an
 * AMS-equipped printer like the Bambu Lab A1: since a lithophane's thickness already
 * varies with image brightness, splitting that thickness range into bands and doing a
 * manual filament color change in Bambu Studio at each band's Z height means each
 * area's *tallest visible layer* — and therefore its printed color — tracks the
 * image's tone. No translucency/color-transmission data needed, unlike true
 * multi-layer color blending (HueForge-style), which this intentionally doesn't
 * attempt — see the README for why.
 */
export function ColorBandGuide({ minThickness, maxThickness }: ColorBandGuideProps) {
  const [bandCount, setBandCount] = useState(3)
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS)

  const activeColors = colors.slice(0, bandCount)
  while (activeColors.length < bandCount) {
    activeColors.push(PALETTE[activeColors.length % PALETTE.length])
  }

  const bandHeight = (maxThickness - minThickness) / bandCount
  const swaps = Array.from({ length: bandCount }, (_, i) => ({
    fromZ: minThickness + i * bandHeight,
    color: activeColors[i],
  }))

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs font-medium text-slate-200">Color band guide (Bambu Studio, AMS)</p>
      <p className="text-xs text-slate-400">
        For an opaque multi-color print (not backlit): brightest areas stay shortest, so they only
        ever show the first color below; darkest areas grow tallest and end up showing the last
        color. This tracks the image's tone using height alone — no color-transmission data needed.
      </p>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Color bands</span>
          <span className="text-slate-500">{bandCount}</span>
        </span>
        <input
          type="range"
          min={2}
          max={6}
          step={1}
          value={bandCount}
          onChange={(e) => setBandCount(Number(e.target.value))}
          className="accent-emerald-500"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        {swaps.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <input
              type="color"
              value={activeColors[i]}
              onChange={(e) => {
                const next = [...activeColors]
                next[i] = e.target.value
                setColors(next)
              }}
              className="h-6 w-8 shrink-0 cursor-pointer rounded border border-slate-700 bg-transparent"
            />
            <span className="flex-1">
              {i === 0 ? 'Start at the base (Z = 0mm)' : `Switch filament at Z = ${s.fromZ.toFixed(2)}mm`}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        In Bambu Studio: after slicing, right-click the object in the layer preview timeline at
        each Z height above and choose "Add color change" — the AMS will swap filament there
        automatically during the print.
      </p>
    </div>
  )
}

interface ElevationColorGuideProps {
  colors: string[]
  baseThickness: number
  reliefMm: number
  hasElevationData: boolean
}

/**
 * Terrain colors are Z bands, so they print as filament changes at layer heights — the
 * preview shows exactly where each color lands. No extra parts or AMS painting needed.
 */
export function ElevationColorGuide({ colors, baseThickness, reliefMm, hasElevationData }: ElevationColorGuideProps) {
  const bandHeight = reliefMm / colors.length
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs font-medium text-slate-200">Elevation color guide (Bambu Studio)</p>
      {!hasElevationData ? (
        <p className="text-xs text-slate-400">Fetch terrain data to see the layer heights for each color.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            Print the whole map in one STL, then in Bambu Studio's layer slider add a color change at
            each height below. The preview colors match these bands exactly.
          </p>
          <ol className="flex flex-col gap-1">
            {colors.map((color, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-4 w-4 shrink-0 rounded border border-slate-600" style={{ background: color }} />
                <span>
                  {i === 0
                    ? `Start with color 1 (from the bed up)`
                    : `Change to color ${i + 1} at Z = ${(baseThickness + i * bandHeight).toFixed(1)}mm`}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

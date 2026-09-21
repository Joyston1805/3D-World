import { Fragment } from 'react'
import { getShape } from '../shapes/catalog'
import { SketchPad } from './SketchPad'
import { useDesignStore } from '../store/useDesignStore'

export function ParamPanel() {
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const values = useDesignStore((s) => s.valuesByShape[s.selectedShapeId])
  const setParam = useDesignStore((s) => s.setParam)
  const resetShape = useDesignStore((s) => s.resetShape)

  const shape = getShape(selectedShapeId)
  if (!shape) return null

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{shape.name}</h2>
          <p className="text-xs text-slate-400">{shape.description}</p>
        </div>
        <button
          onClick={() => resetShape(shape.id)}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {shape.params.map((param) => {
          if (param.showIf && !param.showIf(values)) return null
          const value = values[param.key]
          if (param.type === 'number') {
            return (
              <label key={param.key} className="flex flex-col gap-1 text-xs text-slate-300">
                <span className="flex justify-between">
                  <span>{param.label}</span>
                  <span className="text-slate-500">
                    {value}
                    {param.unit}
                  </span>
                </span>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={Number(value)}
                  onChange={(e) => setParam(param.key, Number(e.target.value))}
                  className="accent-emerald-500"
                />
              </label>
            )
          }
          if (param.type === 'select') {
            const showSketchPad = param.key === 'curveStyle' && value === 'sketch'
            return (
              <Fragment key={param.key}>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span>{param.label}</span>
                  <select
                    value={String(value)}
                    onChange={(e) => setParam(param.key, e.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                  >
                    {param.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {showSketchPad && (
                  <SketchPad
                    value={(values.sketchProfile as number[] | undefined) ?? []}
                    onChange={(profile) => setParam('sketchProfile', profile)}
                  />
                )}
              </Fragment>
            )
          }
          if (param.type === 'boolean') {
            return (
              <label key={param.key} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                <span>{param.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => setParam(param.key, e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-emerald-500"
                />
              </label>
            )
          }
          // color
          return (
            <label key={param.key} className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>{param.label}</span>
              <input
                type="color"
                value={String(value)}
                onChange={(e) => setParam(param.key, e.target.value)}
                className="h-7 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
              />
            </label>
          )
        })}
      </div>

      <p className="mt-auto text-[11px] leading-relaxed text-slate-500">
        Note: plain STL files carry no color data. The color above is for preview only — Bambu
        Studio will apply whatever filament/color you assign after import.
      </p>
    </div>
  )
}

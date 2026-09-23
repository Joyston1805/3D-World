import { Fragment } from 'react'
import type { ComponentGroup, Heightmap, ParamDef, ParamValues } from '../engine/types'
import { getShape, templatesByShapeId } from '../shapes/catalog'
import { ColorBandGuide } from './ColorBandGuide'
import { ImageUploadControl } from './ImageUploadControl'
import { LocationControl } from './LocationControl'
import { SketchPad } from './SketchPad'
import { useDesignStore } from '../store/useDesignStore'

function ParamControl({
  param,
  values,
  setParam,
}: {
  param: ParamDef
  values: ParamValues
  setParam: (key: string, value: number | string | boolean | number[] | Heightmap) => void
}) {
  if (param.showIf && !param.showIf(values)) return null
  const value = values[param.key]

  if (param.type === 'number') {
    return (
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between">
          <span>{param.label}</span>
          <span className="text-slate-500">
            {Number(value)}
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
      <Fragment>
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
      <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
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
    <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
      <span>{param.label}</span>
      <input
        type="color"
        value={String(value)}
        onChange={(e) => setParam(param.key, e.target.value)}
        className="h-7 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
      />
    </label>
  )
}

function ComponentSection({
  group,
  params,
  values,
  setParam,
  setParamsForShape,
  selectedShapeId,
}: {
  group: ComponentGroup
  params: ParamDef[]
  values: ParamValues
  setParam: (key: string, value: number | string | boolean | number[] | Heightmap) => void
  setParamsForShape: (shapeId: string, patch: ParamValues) => void
  selectedShapeId: string
}) {
  const active = group.isActive(values)

  if (!active) {
    return (
      <button
        onClick={() => setParamsForShape(selectedShapeId, group.activate(values))}
        className="flex items-center justify-between rounded-md border border-dashed border-slate-700 px-3 py-2 text-left text-xs text-slate-400 hover:border-emerald-600 hover:text-emerald-300"
      >
        <span>
          <span className="font-medium">+ Add {group.label}</span>
          <span className="block text-[11px] text-slate-500">{group.description}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-emerald-800 bg-emerald-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-emerald-300">{group.label}</p>
          <p className="text-[11px] text-slate-500">{group.description}</p>
        </div>
        <button
          onClick={() => setParamsForShape(selectedShapeId, group.deactivate(values))}
          className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          Remove
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {params.map((param) => (
          <ParamControl key={param.key} param={param} values={values} setParam={setParam} />
        ))}
      </div>
    </div>
  )
}

export function ParamPanel() {
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const values = useDesignStore((s) => s.valuesByShape[s.selectedShapeId])
  const setParam = useDesignStore((s) => s.setParam)
  const setParamsForShape = useDesignStore((s) => s.setParamsForShape)
  const resetShape = useDesignStore((s) => s.resetShape)

  const shape = getShape(selectedShapeId)
  if (!shape) return null

  const isLithophane = shape.id === 'lithophane-panel'
  const isTerrain = shape.id === 'terrain'
  const templates = templatesByShapeId[shape.id]

  const groupedKeys = new Set(shape.componentGroups?.flatMap((g) => g.paramKeys) ?? [])
  const coreParams = shape.params.filter((p) => !groupedKeys.has(p.key))

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

      {templates && templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-slate-300">Quick start</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                title={t.description}
                onClick={() => setParamsForShape(shape.id, t.values)}
                className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-600 hover:text-emerald-300"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {isLithophane && (
          <ImageUploadControl
            label="Click to upload a photo (JPG or PNG)"
            hint="The panel's height auto-adjusts to match the photo's aspect ratio."
            onLoaded={(heightmap: Heightmap, aspect: number) =>
              setParamsForShape(selectedShapeId, {
                heightmap,
                heightMm: Number(values.widthMm) * aspect,
              })
            }
          />
        )}

        {isTerrain && (
          <LocationControl
            lat={Number(values.lat)}
            lon={Number(values.lon)}
            spanKm={Number(values.spanKm)}
            gridResolution={Number(values.gridResolution)}
            onLocationChange={(lat, lon, spanKm) => setParamsForShape(selectedShapeId, { lat, lon, spanKm })}
            onFetched={({ heightmap, minElevationM, maxElevationM }) =>
              setParamsForShape(selectedShapeId, {
                elevationGrid: heightmap,
                elevationRangeM: maxElevationM - minElevationM,
              })
            }
          />
        )}

        {coreParams.map((param) => (
          <ParamControl key={param.key} param={param} values={values} setParam={setParam} />
        ))}

        {shape.componentGroups && shape.componentGroups.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
            <p className="text-xs font-medium text-slate-300">Components</p>
            {shape.componentGroups.map((group) => (
              <ComponentSection
                key={group.id}
                group={group}
                params={shape.params.filter((p) => group.paramKeys.includes(p.key))}
                values={values}
                setParam={setParam}
                setParamsForShape={setParamsForShape}
                selectedShapeId={selectedShapeId}
              />
            ))}
          </div>
        )}

        {isLithophane && (
          <ColorBandGuide minThickness={Number(values.minThickness)} maxThickness={Number(values.maxThickness)} />
        )}
      </div>

      <p className="mt-auto text-[11px] leading-relaxed text-slate-500">
        Note: plain STL files carry no color data. The color above is for preview only — Bambu
        Studio will apply whatever filament/color you assign after import.
      </p>
    </div>
  )
}

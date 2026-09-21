import { buildBlob } from '../engine/blobGeometry'
import type { ComponentGroup, ParamDef, ParamValues, ShapeDefinition } from '../engine/types'
import { defaultValuesFor } from '../engine/types'
import { colorParam, num } from './paramHelpers'

const coreParams: ParamDef[] = [
  num('radius', 'Radius', 10, 150, 2, 50),
  num('detail', 'Detail (facet density)', 0, 4, 1, 2, ''),
  num('seed', 'Seed (reroll for a new one)', 0, 999, 1, 7, ''),
  { type: 'boolean', key: 'faceted', label: 'Faceted (flat shading)', default: false },
  colorParam('#b5b5b5'),
]

const roughnessParams: ParamDef[] = [
  num('noiseAmount', 'Roughness depth', 0.5, 35, 0.5, 0),
  num('noiseScale', 'Roughness scale', 0.5, 6, 0.1, 1.6, ''),
]

const flattenParams: ParamDef[] = [num('squash', 'Flatten amount', 0.05, 0.6, 0.05, 0, '')]

export const componentGroups: ComponentGroup[] = [
  {
    id: 'roughness',
    label: 'Roughness',
    description: 'Noise-displaces the surface — from gem facets to craggy rock, depending on Detail.',
    paramKeys: roughnessParams.map((d) => d.key),
    isActive: (v) => Number(v.noiseAmount) > 0,
    activate: (v) => ({ ...v, noiseAmount: 10 }),
    deactivate: (v) => ({ ...v, noiseAmount: 0 }),
  },
  {
    id: 'flatten',
    label: 'Flatten',
    description: 'Squashes the top and bottom — an egg/lens shape instead of a sphere.',
    paramKeys: flattenParams.map((d) => d.key),
    isActive: (v) => Number(v.squash) > 0,
    activate: (v) => ({ ...v, squash: 0.25 }),
    deactivate: (v) => ({ ...v, squash: 0 }),
  },
]

const allParams: ParamDef[] = [...coreParams, ...roughnessParams, ...flattenParams]

function build(values: ParamValues) {
  return buildBlob({
    radius: Number(values.radius),
    detail: Number(values.detail),
    noiseAmount: Number(values.noiseAmount),
    noiseScale: Number(values.noiseScale),
    seed: Number(values.seed),
    squash: Number(values.squash),
    faceted: Boolean(values.faceted),
  })
}

export const blobDefaults: ParamValues = defaultValuesFor(allParams)

export const blob: ShapeDefinition = {
  id: 'blob',
  name: 'Blob',
  description:
    'A noise-displaced sphere — the mathematical base behind gems, rocks, and asteroids. Starts as a plain sphere; add components below to shape it further.',
  params: allParams,
  componentGroups,
  build,
}

export const blobShapes: ShapeDefinition[] = [blob]

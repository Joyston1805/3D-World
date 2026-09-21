import { buildBlob } from '../engine/blobGeometry'
import type { ParamDef, ParamValues, ShapeDefinition } from '../engine/types'
import { colorParam, num } from './paramHelpers'

function blobParams(cfg: {
  radius: [number, number, number, number]
  detail: [number, number, number, number]
  noiseAmount: [number, number, number, number]
  noiseScale: [number, number, number, number]
  seed: [number, number, number, number]
  squash: [number, number, number, number]
  facetedDefault: boolean
  color: string
}): ParamDef[] {
  return [
    num('radius', 'Radius', ...cfg.radius),
    num('detail', 'Detail (facet density)', ...cfg.detail, ''),
    num('noiseAmount', 'Roughness depth', ...cfg.noiseAmount),
    num('noiseScale', 'Roughness scale', ...cfg.noiseScale, ''),
    num('squash', 'Flatten top/bottom', ...cfg.squash, ''),
    num('seed', 'Seed (reroll for a new one)', ...cfg.seed, ''),
    { type: 'boolean', key: 'faceted', label: 'Faceted (flat shading)', default: cfg.facetedDefault },
    colorParam(cfg.color),
  ]
}

function buildFromValues(values: ParamValues) {
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

export const crystalGem: ShapeDefinition = {
  id: 'crystal-gem',
  name: 'Crystal Gem',
  description:
    'A faceted, noise-displaced icosahedron — low "detail" keeps large gem-like facets. Solid (not hollow).',
  params: blobParams({
    radius: [10, 100, 2, 35],
    detail: [0, 3, 1, 1],
    noiseAmount: [0, 20, 0.5, 5],
    noiseScale: [0.5, 6, 0.1, 1.8],
    seed: [0, 999, 1, 7],
    squash: [0, 0.6, 0.05, 0.25],
    facetedDefault: true,
    color: '#8ec9f0',
  }),
  build: (values) => buildFromValues(values),
}

export const boulder: ShapeDefinition = {
  id: 'boulder',
  name: 'Boulder',
  description: 'A noise-displaced rock/asteroid form. Higher "detail" and roughness give a craggier look. Solid.',
  params: blobParams({
    radius: [20, 150, 2, 55],
    detail: [1, 4, 1, 3],
    noiseAmount: [0, 35, 0.5, 14],
    noiseScale: [0.5, 6, 0.1, 1.4],
    seed: [0, 999, 1, 42],
    squash: [0, 0.6, 0.05, 0.1],
    facetedDefault: false,
    color: '#8a8578',
  }),
  build: (values) => buildFromValues(values),
}

export const blobShapes: ShapeDefinition[] = [crystalGem, boulder]

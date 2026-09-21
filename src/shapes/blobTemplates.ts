import type { ShapeTemplate } from '../engine/types'
import { blobDefaults } from './blobShapes'

function template(
  id: string,
  name: string,
  description: string,
  overrides: Record<string, number | string | boolean>,
): ShapeTemplate {
  return { id, name, description, values: { ...blobDefaults, ...overrides } }
}

export const blobTemplates: ShapeTemplate[] = [
  template(
    'crystal-gem',
    'Crystal Gem',
    'A faceted, noise-displaced icosahedron — low "detail" keeps large gem-like facets. Solid (not hollow).',
    {
      radius: 35,
      detail: 1,
      noiseAmount: 5,
      noiseScale: 1.8,
      seed: 7,
      squash: 0.25,
      faceted: true,
      color: '#8ec9f0',
    },
  ),
  template(
    'boulder',
    'Boulder',
    'A noise-displaced rock/asteroid form. Higher "detail" and roughness give a craggier look. Solid.',
    {
      radius: 55,
      detail: 3,
      noiseAmount: 14,
      noiseScale: 1.4,
      seed: 42,
      squash: 0.1,
      faceted: false,
      color: '#8a8578',
    },
  ),
]

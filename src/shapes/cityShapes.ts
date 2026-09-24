import { buildCityMap, buildCityscape } from '../engine/cityGeometry'
import { colorParams, colorThemes } from '../engine/cityPalette'
import type { ComponentGroup, ParamDef, ParamValues, ShapeDefinition, ShapeTemplate } from '../engine/types'
import { defaultValuesFor } from '../engine/types'
import { num } from './paramHelpers'

const hidden = () => false

// ---------- Cityscape (procedural) ----------

const coreParams: ParamDef[] = [
  num('seed', 'Seed (reroll for a new city)', 1, 999, 1, 7, ''),
  {
    type: 'select',
    key: 'plateShape',
    label: 'Base shape',
    options: [
      { value: 'square', label: 'Square' },
      { value: 'round', label: 'Round (island)' },
    ],
    default: 'square',
  },
  num('sizeMm', 'Print size', 60, 250, 5, 150),
  num('cells', 'Blocks per side', 6, 30, 1, 14, ''),
  num('streetPct', 'Street width', 10, 50, 1, 25, '%'),
  num('minHeight', 'Shortest building', 2, 40, 1, 6),
  num('maxHeight', 'Tallest building', 10, 160, 2, 70),
  num('downtownFocus', 'Downtown focus', 0, 1, 0.05, 0.7, ''),
  num('plateThickness', 'Base thickness', 1, 8, 0.5, 2),
]

const parksParams: ParamDef[] = [num('parkChance', 'Park share', 0.02, 0.4, 0.02, 0, '')]
const tiersParams: ParamDef[] = [num('tierChance', 'Share of towers with setbacks', 0.1, 1, 0.05, 0, '')]
const spiresParams: ParamDef[] = [num('spireChance', 'Share of towers with spires', 0.1, 1, 0.05, 0, '')]

const cityscapeGroups: ComponentGroup[] = [
  {
    id: 'parks',
    label: 'Parks',
    description: 'Leaves some blocks empty — open squares between the buildings.',
    paramKeys: parksParams.map((d) => d.key),
    isActive: (v) => Number(v.parkChance) > 0,
    activate: (v) => ({ ...v, parkChance: 0.1 }),
    deactivate: (v) => ({ ...v, parkChance: 0 }),
  },
  {
    id: 'tiers',
    label: 'Setback tiers',
    description: 'Tall towers step in as they rise — the wedding-cake Art Deco skyscraper look.',
    paramKeys: tiersParams.map((d) => d.key),
    isActive: (v) => Number(v.tierChance) > 0,
    activate: (v) => ({ ...v, tierChance: 0.6 }),
    deactivate: (v) => ({ ...v, tierChance: 0 }),
  },
  {
    id: 'spires',
    label: 'Spires',
    description: 'Thin antennas and spires on top of the tallest towers.',
    paramKeys: spiresParams.map((d) => d.key),
    isActive: (v) => Number(v.spireChance) > 0,
    activate: (v) => ({ ...v, spireChance: 0.5 }),
    deactivate: (v) => ({ ...v, spireChance: 0 }),
  },
]

const cityscapeParams: ParamDef[] = [...coreParams, ...colorParams, ...parksParams, ...tiersParams, ...spiresParams]
export const cityscapeDefaults: ParamValues = defaultValuesFor(cityscapeParams)

export const cityscape: ShapeDefinition = {
  id: 'cityscape',
  name: 'Cityscape',
  description:
    'A procedurally generated city on a street grid — every seed is a different skyline. Pick the colors (up to four filaments plus the base), then add parks, setback towers, and spires. Every building is one solid color, so it exports as a multi-color 3MF.',
  params: cityscapeParams,
  componentGroups: cityscapeGroups,
  zUp: true,
  multiColor: true,
  build: (v) =>
    buildCityscape({
      seed: Number(v.seed),
      round: v.plateShape === 'round',
      sizeMm: Number(v.sizeMm),
      cells: Number(v.cells),
      streetPct: Number(v.streetPct),
      minHeight: Number(v.minHeight),
      maxHeight: Math.max(Number(v.maxHeight), Number(v.minHeight) + 1),
      downtownFocus: Number(v.downtownFocus),
      parkChance: Number(v.parkChance),
      tierChance: Number(v.tierChance),
      spireChance: Number(v.spireChance),
      plateThickness: Number(v.plateThickness),
      colors: v,
    }),
}

// ---------- City Map (real OpenStreetMap footprints) ----------

const cityMapParams: ParamDef[] = [
  num('lat', 'Latitude', -90, 90, 0.0001, 41.8827, '', hidden),
  num('lon', 'Longitude', -180, 180, 0.0001, -87.6233, '', hidden),
  num('spanKm', 'Area span', 0.3, 2, 0.1, 0.8, 'km', hidden),
  num('widthMm', 'Print size', 60, 250, 5, 150),
  num('plateThickness', 'Base thickness', 1, 8, 0.5, 2),
  num('heightExaggeration', 'Building height exaggeration', 1, 8, 0.5, 2.5, 'x'),
  num('minHeightMm', 'Minimum building height', 0.4, 4, 0.2, 1),
  ...colorParams,
]

export const cityMap: ShapeDefinition = {
  id: 'citymap',
  name: 'City Map',
  description:
    'A real place, printed: every building footprint in the area from OpenStreetMap, extruded to its real height. Pick a city preset (or enter any coordinates), fetch the buildings, then choose your colors.',
  params: cityMapParams,
  zUp: true,
  multiColor: true,
  build: (v) =>
    buildCityMap({
      footprints: Array.isArray(v.footprints) ? (v.footprints as number[]) : [],
      spanKm: Number(v.spanKm),
      widthMm: Number(v.widthMm),
      plateThickness: Number(v.plateThickness),
      heightExaggeration: Number(v.heightExaggeration),
      minHeightMm: Number(v.minHeightMm),
      colors: v,
    }),
}

export const cityShapes: ShapeDefinition[] = [cityscape, cityMap]

// ---------- Quick-start templates ----------

const layout = (
  id: string,
  name: string,
  description: string,
  o: Record<string, number | string>,
): ShapeTemplate => ({
  id,
  name,
  description,
  values: {
    seed: 7,
    plateShape: 'square',
    sizeMm: 150,
    cells: 14,
    streetPct: 25,
    minHeight: 6,
    maxHeight: 70,
    downtownFocus: 0.7,
    plateThickness: 2,
    parkChance: 0,
    tierChance: 0,
    spireChance: 0,
    ...o,
  },
})

const themeTemplates: ShapeTemplate[] = colorThemes.map((t) => ({
  id: `theme-${t.id}`,
  name: `Colors: ${t.name}`,
  description: 'Sets the building and base colors. Layout is left unchanged.',
  values: t.values,
}))

export const cityscapeTemplates: ShapeTemplate[] = [
  layout('downtown', 'Downtown', 'Tall setback towers clustered in the middle, parks around.', {
    cells: 14,
    maxHeight: 90,
    downtownFocus: 0.85,
    parkChance: 0.06,
    tierChance: 0.7,
    spireChance: 0.5,
  }),
  layout('megacity', 'Megacity', 'Dense grid, very tall, lots of spires.', {
    cells: 22,
    streetPct: 18,
    minHeight: 8,
    maxHeight: 120,
    downtownFocus: 0.6,
    parkChance: 0.03,
    tierChance: 0.8,
    spireChance: 0.6,
  }),
  layout('suburb', 'Small Town', 'Low buildings, wide streets, plenty of green space.', {
    cells: 18,
    streetPct: 35,
    minHeight: 3,
    maxHeight: 22,
    downtownFocus: 0.2,
    parkChance: 0.15,
  }),
  layout('island', 'City Island', 'A round base with the skyline rising toward the center.', {
    plateShape: 'round',
    cells: 16,
    maxHeight: 80,
    downtownFocus: 0.9,
    parkChance: 0.1,
    tierChance: 0.5,
    spireChance: 0.4,
  }),
  ...themeTemplates,
]

export const cityMapTemplates: ShapeTemplate[] = themeTemplates

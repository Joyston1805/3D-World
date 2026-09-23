import { buildTerrainPanel } from '../engine/terrainGeometry'
import type { Heightmap, ParamValues, ShapeDefinition } from '../engine/types'
import { colorParam, num } from './paramHelpers'

/** Flat fallback before elevation data has been fetched. */
const FLAT_ELEVATION: Heightmap = { data: new Float32Array([0.5, 0.5, 0.5, 0.5]), cols: 2, rows: 2 }

const hidden = () => false

export const terrainMap: ShapeDefinition = {
  id: 'terrain',
  name: 'Terrain Map',
  description:
    'A 3D-printable topographic relief of a real place, built from real elevation data — pick a location (or one of the presets) and fetch it. Inspired by 3D-printed trail/topo map art.',
  params: [
    num('lat', 'Latitude', -90, 90, 0.0001, 36.1069, '', hidden),
    num('lon', 'Longitude', -180, 180, 0.0001, -112.1129, '', hidden),
    num('spanKm', 'Area span', 0.5, 20, 0.5, 15, 'km', hidden),
    num('gridResolution', 'Detail (grid resolution)', 10, 50, 2, 24, ''),
    num('widthMm', 'Print width', 60, 250, 5, 150),
    num('baseThickness', 'Base thickness', 1, 5, 0.2, 2),
    num('verticalExaggeration', 'Vertical exaggeration', 1, 15, 0.5, 5, 'x'),
    colorParam('#8a9a6b'),
  ],
  build: (values: ParamValues) =>
    buildTerrainPanel({
      elevationGrid: (values.elevationGrid as Heightmap | undefined) ?? FLAT_ELEVATION,
      elevationRangeM: Number(values.elevationRangeM ?? 0),
      spanKm: Number(values.spanKm),
      widthMm: Number(values.widthMm),
      baseThickness: Number(values.baseThickness),
      verticalExaggeration: Number(values.verticalExaggeration),
      resolution: Number(values.gridResolution),
    }),
}

export const terrainShapes: ShapeDefinition[] = [terrainMap]

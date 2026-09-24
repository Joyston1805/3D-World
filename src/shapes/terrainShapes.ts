import { bandColors } from '../engine/cityPalette'
import { buildTerrainPanel } from '../engine/terrainGeometry'
import type { Heightmap, ParamDef, ParamValues, ShapeDefinition, ShapeTemplate } from '../engine/types'
import { unflattenRoute } from '../lib/gpx'
import { num } from './paramHelpers'

/** Flat fallback before elevation data has been fetched. */
const FLAT_ELEVATION: Heightmap = { data: new Float32Array([0.1, 0.1, 0.1, 0.1]), cols: 2, rows: 2 }

/** Mesh resolution when a GPX route is embossed — decoupled from the (rate-limited)
 *  elevation fetch grid, since a crisp route line needs a much finer mesh than the
 *  elevation data itself, and sampleHeightmap already interpolates smoothly regardless. */
const ROUTE_MESH_RESOLUTION = 90

const hidden = () => false
const elevationColored = (v: ParamValues) => v.colorMode !== 'single'
const bandShown = (n: number) => (v: ParamValues) => elevationColored(v) && Number(v.bandCount) >= n
const ELEVATION_DEFAULTS = ['#4f7942', '#b89f6a', '#8d8d8d', '#ffffff']

const colorParams: ParamDef[] = [
  {
    type: 'select',
    key: 'colorMode',
    label: 'Color by',
    options: [
      { value: 'elevation', label: 'Elevation' },
      { value: 'single', label: 'One color' },
    ],
    default: 'elevation',
  },
  num('bandCount', 'Elevation colors (filaments)', 2, 4, 1, 4, '', elevationColored),
  ...ELEVATION_DEFAULTS.map(
    (def, i): ParamDef => ({
      type: 'color',
      key: `color${i + 1}`,
      label: i === 0 ? 'Color 1 (lowest)' : `Color ${i + 1}`,
      default: def,
      showIf: i === 0 ? elevationColored : bandShown(i + 1),
    }),
  ),
  { type: 'color', key: 'color', label: 'Color', default: '#8a9a6b', showIf: (v) => !elevationColored(v) },
]

const hasRoute = (v: ParamValues) => Array.isArray(v.routePoints) && v.routePoints.length > 3

export const terrainMap: ShapeDefinition = {
  id: 'terrain',
  zUp: true,
  name: 'Terrain Map',
  description:
    'A 3D-printable topographic relief of a real place, built from real elevation data — pick a location (or one of the presets), or upload a GPX route to trace your exact ride/run as a raised line over the terrain. Inspired by 3D-printed trail/topo map art.',
  params: [
    num('lat', 'Latitude', -90, 90, 0.0001, 36.1069, '', hidden),
    num('lon', 'Longitude', -180, 180, 0.0001, -112.1129, '', hidden),
    num('spanKm', 'Area span', 0.5, 20, 0.5, 15, 'km', hidden),
    num('gridResolution', 'Detail (grid resolution)', 10, 50, 2, 24, ''),
    num('widthMm', 'Print width', 60, 250, 5, 150),
    num('baseThickness', 'Base thickness', 1, 5, 0.2, 2),
    num('verticalExaggeration', 'Vertical exaggeration', 1, 15, 0.5, 5, 'x'),
    num('routeEmbossHeight', 'Route emboss height', 0.5, 5, 0.1, 1.5, 'mm', hasRoute),
    num('routeWidth', 'Route line width', 1, 8, 0.5, 2.5, 'mm', hasRoute),
    ...colorParams,
  ],
  build: (values: ParamValues) => {
    const routePoints = Array.isArray(values.routePoints) ? (values.routePoints as number[]) : []
    const route = routePoints.length > 3 ? unflattenRoute(routePoints) : undefined
    return buildTerrainPanel({
      elevationGrid: (values.elevationGrid as Heightmap | undefined) ?? FLAT_ELEVATION,
      elevationRangeM: Number(values.elevationRangeM ?? 0),
      spanKm: Number(values.spanKm),
      centerLat: Number(values.lat),
      centerLon: Number(values.lon),
      widthMm: Number(values.widthMm),
      baseThickness: Number(values.baseThickness),
      verticalExaggeration: Number(values.verticalExaggeration),
      resolution: route ? ROUTE_MESH_RESOLUTION : Number(values.gridResolution),
      route,
      routeEmbossHeight: Number(values.routeEmbossHeight ?? 1.5),
      routeWidth: Number(values.routeWidth ?? 2.5),
      bandColors: elevationColored(values) ? bandColors(values) : undefined,
    })
  },
}

export const terrainShapes: ShapeDefinition[] = [terrainMap]

const theme = (id: string, name: string, bands: string[]): ShapeTemplate => ({
  id,
  name: `Colors: ${name}`,
  description: 'Sets the elevation colors, lowest to highest.',
  values: {
    colorMode: 'elevation',
    bandCount: bands.length,
    color1: bands[0],
    color2: bands[1],
    color3: bands[2] ?? bands[1],
    color4: bands[3] ?? bands[bands.length - 1],
  },
})

export const terrainTemplates: ShapeTemplate[] = [
  theme('alpine', 'Alpine', ['#4f7942', '#b89f6a', '#8d8d8d', '#ffffff']),
  theme('desert', 'Desert', ['#e9c46a', '#f4a261', '#e76f51', '#7f4f24']),
  theme('arctic', 'Arctic', ['#1d3557', '#457b9d', '#a8dadc', '#ffffff']),
  theme('topo', 'Topo Map', ['#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']),
  theme('forest', 'Forest', ['#1b4332', '#40916c', '#95d5b2', '#d8f3dc']),
  { id: 'mono', name: 'Colors: One Color', description: 'A single color for the whole map.', values: { colorMode: 'single' } },
]

import { buildTerrainPanel } from '../engine/terrainGeometry'
import type { Heightmap, ParamValues, ShapeDefinition } from '../engine/types'
import { unflattenRoute } from '../lib/gpx'
import { colorParam, num } from './paramHelpers'

/** Flat fallback before elevation data has been fetched. */
const FLAT_ELEVATION: Heightmap = { data: new Float32Array([0.5, 0.5, 0.5, 0.5]), cols: 2, rows: 2 }

/** Mesh resolution when a GPX route is embossed — decoupled from the (rate-limited)
 *  elevation fetch grid, since a crisp route line needs a much finer mesh than the
 *  elevation data itself, and sampleHeightmap already interpolates smoothly regardless. */
const ROUTE_MESH_RESOLUTION = 90

const hidden = () => false
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
    colorParam('#8a9a6b'),
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
    })
  },
}

export const terrainShapes: ShapeDefinition[] = [terrainMap]

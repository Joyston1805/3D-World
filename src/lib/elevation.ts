import type { Heightmap } from '../engine/types'

const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation'
const BATCH_SIZE = 100 // Open-Meteo's per-request coordinate limit.
const METERS_PER_DEGREE_LAT = 111_320

export interface ElevationGrid {
  /** Normalized 0..1 heightmap (0 = lowest point in the sampled area). */
  heightmap: Heightmap
  minElevationM: number
  maxElevationM: number
}

/**
 * Samples a gridSize x gridSize grid of real-world elevation over a spanKm x spanKm
 * square centered at (centerLat, centerLon), via Open-Meteo's free, key-less elevation
 * API (batches requests since it caps at 100 coordinates each). No account, no API key
 * — matches the "no accounts" spirit of the sites this feature is modeled on.
 */
export async function fetchElevationGrid(
  centerLat: number,
  centerLon: number,
  spanKm: number,
  gridSize: number,
  onProgress?: (fraction: number) => void,
): Promise<ElevationGrid> {
  const halfSpanDegLat = spanKm / 2 / (METERS_PER_DEGREE_LAT / 1000)
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180)
  const halfSpanDegLon = spanKm / 2 / (metersPerDegreeLon / 1000)

  const lats: number[] = []
  const lons: number[] = []
  // Row-major, top (north) to bottom (south), matching the relief panel's v=0..1 (top..bottom).
  for (let i = 0; i < gridSize; i++) {
    const lat = centerLat + halfSpanDegLat - (i / (gridSize - 1)) * (2 * halfSpanDegLat)
    for (let j = 0; j < gridSize; j++) {
      const lon = centerLon - halfSpanDegLon + (j / (gridSize - 1)) * (2 * halfSpanDegLon)
      lats.push(lat)
      lons.push(lon)
    }
  }

  const total = lats.length
  const elevations = new Float32Array(total)
  let fetched = 0
  for (let start = 0; start < total; start += BATCH_SIZE) {
    const end = Math.min(total, start + BATCH_SIZE)
    const latParam = lats.slice(start, end).join(',')
    const lonParam = lons.slice(start, end).join(',')
    const res = await fetch(`${ELEVATION_API}?latitude=${latParam}&longitude=${lonParam}`)
    if (!res.ok) {
      throw new Error(`Elevation lookup failed (${res.status}). The area may be invalid, or the free API is busy.`)
    }
    const json = (await res.json()) as { elevation?: number[] }
    if (!json.elevation || json.elevation.length !== end - start) {
      throw new Error('Elevation API returned an unexpected response.')
    }
    elevations.set(json.elevation, start)
    fetched = end
    onProgress?.(fetched / total)
  }

  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] < min) min = elevations[i]
    if (elevations[i] > max) max = elevations[i]
  }
  const range = Math.max(1, max - min)

  const normalized = new Float32Array(total)
  for (let i = 0; i < total; i++) normalized[i] = (elevations[i] - min) / range

  return {
    heightmap: { data: normalized, cols: gridSize, rows: gridSize },
    minElevationM: min,
    maxElevationM: max,
  }
}

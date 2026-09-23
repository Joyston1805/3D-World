const METERS_PER_DEGREE_LAT = 111_320

export interface GpxPoint {
  lat: number
  lon: number
}

function decimate(points: GpxPoint[], maxPoints: number): GpxPoint[] {
  if (points.length <= maxPoints) return points
  const stride = points.length / maxPoints
  const result: GpxPoint[] = []
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.floor(i * stride)])
  result.push(points[points.length - 1])
  return result
}

/** Parses <trkpt> (track) or, failing that, <rtept> (route) points from a GPX file's text. */
export function parseGpxText(text: string): GpxPoint[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not parse this file as GPX/XML.')

  const extract = (tag: string): GpxPoint[] =>
    Array.from(doc.getElementsByTagName(tag))
      .map((el) => ({ lat: parseFloat(el.getAttribute('lat') ?? ''), lon: parseFloat(el.getAttribute('lon') ?? '') }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))

  let points = extract('trkpt')
  if (points.length === 0) points = extract('rtept')
  if (points.length < 2) throw new Error('No track points found in this GPX file.')

  // Cap point count for build performance — a route's shape survives decimation fine
  // at this resolution, and the mesh only samples it at panel resolution anyway.
  return decimate(points, 400)
}

export async function parseGpxFile(file: File): Promise<GpxPoint[]> {
  const text = await file.text()
  return parseGpxText(text)
}

/** Bounding box of a route, expanded with padding and converted to a center + square span. */
export function routeBounds(points: GpxPoint[]): { centerLat: number; centerLon: number; spanKm: number } {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  const centerLat = (minLat + maxLat) / 2
  const centerLon = (minLon + maxLon) / 2
  const latSpanKm = ((maxLat - minLat) * METERS_PER_DEGREE_LAT) / 1000
  const lonSpanKm = ((maxLon - minLon) * METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180)) / 1000
  const spanKm = Math.max(latSpanKm, lonSpanKm) * 1.3 // padding so the route isn't flush with the panel edge
  return { centerLat, centerLon, spanKm: Math.max(0.5, Math.min(20, spanKm)) }
}

/** Route points are stored in ParamValues as a flat [lat0, lon0, lat1, lon1, ...] number[]. */
export function flattenRoute(points: GpxPoint[]): number[] {
  const flat: number[] = []
  for (const p of points) flat.push(p.lat, p.lon)
  return flat
}

export function unflattenRoute(flat: number[]): GpxPoint[] {
  const points: GpxPoint[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) points.push({ lat: flat[i], lon: flat[i + 1] })
  return points
}

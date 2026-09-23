const METERS_PER_DEGREE_LAT = 111_320

export function metersPerDegreeLon(centerLatDeg: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((centerLatDeg * Math.PI) / 180)
}

/**
 * Converts a lat/lon to normalized (u, v) in [0,1]x[0,1] within a spanKm-wide square
 * centered at (centerLat, centerLon). u=0 west edge..1 east edge; v=0 north edge..1
 * south edge — matching the relief panel's convention (v=0 is the top row).
 */
export function latLonToUV(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  spanKm: number,
): { u: number; v: number } {
  const halfSpanDegLat = spanKm / 2 / (METERS_PER_DEGREE_LAT / 1000)
  const halfSpanDegLon = spanKm / 2 / (metersPerDegreeLon(centerLat) / 1000)
  const v = 0.5 - (lat - centerLat) / (2 * halfSpanDegLat)
  const u = 0.5 + (lon - centerLon) / (2 * halfSpanDegLon)
  return { u, v }
}

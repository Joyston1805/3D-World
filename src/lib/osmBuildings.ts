import type { Footprint } from '../engine/cityGeometry'
import { latLonToUV } from './geo'

/**
 * Real building footprints from OpenStreetMap via the public Overpass API (free, no
 * account or key, CORS-enabled). Heights come from the `height` tag, else
 * `building:levels` x 3.2m, else a modest default — OSM height coverage varies a lot by
 * city, so untagged buildings are a real (documented) source of flatness.
 */

// Public Overpass servers are volunteer-run and intermittently overloaded, so try several.
const ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
]
const PER_ENDPOINT_TIMEOUT_MS = 25_000
const MAX_BUILDINGS = 5000
const DEFAULT_HEIGHT_M = 12
const METERS_PER_LEVEL = 3.2

interface LatLon {
  lat: number
  lon: number
}

interface OverpassElement {
  type: string
  tags?: Record<string, string>
  geometry?: LatLon[]
  members?: { type: string; role: string; geometry?: LatLon[] }[]
}

function parseHeightM(tags: Record<string, string>): number {
  const h = parseFloat(tags.height ?? '')
  if (Number.isFinite(h) && h > 0) return /ft|feet|'/.test(tags.height) ? h * 0.3048 : h
  const levels = parseFloat(tags['building:levels'] ?? '')
  if (Number.isFinite(levels) && levels > 0) return levels * METERS_PER_LEVEL
  return DEFAULT_HEIGHT_M
}

// Overpass answers 429/504 almost instantly when its query slots are momentarily full;
// an immediate retry usually succeeds, so retry those on the same server before moving on.
const RETRYABLE = new Set([429, 502, 503, 504])
const ATTEMPTS_PER_ENDPOINT = 2

/** `bestEffort` queries try the primary server once and return [] on any failure instead of throwing. */
async function queryOverpass(query: string, bestEffort = false): Promise<OverpassElement[]> {
  const errors: string[] = []
  const endpoints = bestEffort ? ENDPOINTS.slice(0, 1) : ENDPOINTS
  const attempts = bestEffort ? 1 : ATTEMPTS_PER_ENDPOINT
  for (const url of endpoints) {
    const host = new URL(url).host
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(PER_ENDPOINT_TIMEOUT_MS),
        })
        if (res.ok) {
          const json = (await res.json()) as { elements?: OverpassElement[] }
          return json.elements ?? []
        }
        if (attempt === attempts || !RETRYABLE.has(res.status)) {
          errors.push(`${host}: HTTP ${res.status}`)
          break
        }
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      } catch (err) {
        errors.push(`${host}: ${err instanceof Error ? err.message : 'failed'}`)
        break
      }
    }
  }
  if (bestEffort) return []
  throw new Error(
    `The free OpenStreetMap servers are busy or unreachable right now (${errors.join('; ')}). Wait a minute and try again, or pick a smaller area.`,
  )
}

export interface FetchedCity {
  footprints: Footprint[]
  totalFound: number
  taggedHeightCount: number
}

export async function fetchBuildingFootprints(lat: number, lon: number, spanKm: number): Promise<FetchedCity> {
  const halfLat = spanKm / 2 / 111.32
  const halfLon = spanKm / 2 / (111.32 * Math.cos((lat * Math.PI) / 180))
  const bbox = [lat - halfLat, lon - halfLon, lat + halfLat, lon + halfLon].map((v) => v.toFixed(6)).join(',')
  const ways = await queryOverpass(`[out:json][timeout:25];way["building"](${bbox});out geom tags;`)
  // Big/complex buildings are multipolygon relations; this heavier query is optional so a
  // busy server degrades to "ways only" rather than failing the whole fetch.
  const relations = await queryOverpass(
    `[out:json][timeout:25];relation["building"]["type"="multipolygon"](${bbox});out geom tags;`,
    true,
  )
  const elements = [...ways, ...relations]

  const footprints: Footprint[] = []
  let tagged = 0
  const addRing = (ring: LatLon[], tags: Record<string, string>) => {
    const pts = ring.map((g) => {
      const { u, v } = latLonToUV(g.lat, g.lon, lat, lon, spanKm)
      return [u, v] as [number, number]
    })
    // OSM closed rings repeat the first node at the end.
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) pts.pop()
    if (pts.length < 3) return
    // Skip buildings entirely outside the fetched square.
    if (pts.every(([u, v]) => u < 0 || u > 1 || v < 0 || v > 1)) return
    footprints.push({ heightM: parseHeightM(tags), points: pts })
  }
  for (const el of elements) {
    if (footprints.length >= MAX_BUILDINGS) break
    const tags = el.tags ?? {}
    if (tags.height || tags['building:levels']) tagged++
    if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
      addRing(el.geometry, tags)
    } else if (el.type === 'relation') {
      // Large/complex buildings are multipolygon relations. Use each closed outer ring;
      // courtyards (inner rings) are filled in rather than cut out.
      for (const m of el.members ?? []) {
        const g = m.geometry
        if (m.type === 'way' && m.role === 'outer' && g && g.length >= 4) {
          const a = g[0]
          const b = g[g.length - 1]
          if (a.lat === b.lat && a.lon === b.lon) addRing(g, tags)
        }
      }
    }
  }
  if (footprints.length === 0) throw new Error('No buildings found here — try a more urban location.')
  return { footprints, totalFound: elements.length, taggedHeightCount: tagged }
}

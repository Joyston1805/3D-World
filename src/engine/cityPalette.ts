import * as THREE from 'three'
import type { ParamDef, ParamValues } from './types'

/**
 * Shared color system for the city shapes. Colors map to real filaments: a print has
 * at most `bandCount` (1-4, matching an AMS's four slots) building colors plus a base
 * color, and every building is one uniform color so the model can be split per-color
 * on export.
 */

export type ColorMode = 'height' | 'random' | 'single'

export const MAX_BANDS = 4
const DEFAULT_BAND_COLORS = ['#e8e4dc', '#a9b7c6', '#5f7a95', '#2f4560']

const bandShown = (n: number) => (v: ParamValues) => Number(v.bandCount) >= n

export const colorParams: ParamDef[] = [
  {
    type: 'select',
    key: 'colorMode',
    label: 'Color by',
    options: [
      { value: 'height', label: 'Building height' },
      { value: 'random', label: 'Random per building' },
      { value: 'single', label: 'One color' },
    ],
    default: 'height',
  },
  {
    type: 'number',
    key: 'bandCount',
    label: 'Building colors (filaments)',
    min: 1,
    max: MAX_BANDS,
    step: 1,
    default: 3,
    unit: '',
    showIf: (v) => v.colorMode !== 'single',
  },
  ...DEFAULT_BAND_COLORS.map(
    (def, i): ParamDef => ({
      type: 'color',
      key: `color${i + 1}`,
      label: i === 0 ? 'Building color 1 (shortest)' : `Building color ${i + 1}`,
      default: def,
      showIf: i === 0 ? undefined : bandShown(i + 1),
    }),
  ),
  { type: 'color', key: 'baseColor', label: 'Base plate color', default: '#2b2d31' },
]

export const colorParamKeys = colorParams.map((p) => p.key)

export interface ColorTheme {
  id: string
  name: string
  values: ParamValues
}

const theme = (id: string, name: string, bands: string[], base: string, mode: ColorMode = 'height'): ColorTheme => ({
  id,
  name,
  values: {
    colorMode: mode,
    bandCount: bands.length,
    color1: bands[0],
    color2: bands[1] ?? bands[0],
    color3: bands[2] ?? bands[0],
    color4: bands[3] ?? bands[0],
    baseColor: base,
  },
})

export const colorThemes: ColorTheme[] = [
  theme('concrete', 'Concrete', ['#e8e4dc', '#a9b7c6', '#5f7a95'], '#2b2d31'),
  theme('sunset', 'Sunset', ['#ffd166', '#ef8354', '#d1495b', '#5c2a63'], '#1f1a2e'),
  theme('neon', 'Neon Night', ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'], '#0b0b14'),
  theme('ice', 'Ice', ['#ffffff', '#cfe8f7', '#8ab8dd'], '#1d3557'),
  theme('gold', 'Gold Skyline', ['#f4f1ea', '#d4af37'], '#1a1a1a'),
  theme('confetti', 'Confetti', ['#ffbe0b', '#fb5607', '#8338ec', '#3a86ff'], '#222222', 'random'),
  theme('mono', 'One Color', ['#d9d9d9'], '#444444', 'single'),
]

/** The band palette (length = active building colors) for the current values. */
export function bandColors(values: ParamValues): THREE.Color[] {
  const n = values.colorMode === 'single' ? 1 : Math.max(1, Math.min(MAX_BANDS, Math.round(Number(values.bandCount))))
  return Array.from({ length: n }, (_, i) => new THREE.Color(String(values[`color${i + 1}`] ?? DEFAULT_BAND_COLORS[i])))
}

export function baseColor(values: ParamValues): THREE.Color {
  return new THREE.Color(String(values.baseColor ?? '#2b2d31'))
}

/** Deterministic 0..1 hash of an integer, for the "random" mode. */
function hash01(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Pick each building's band. "height" uses each building's rank among all heights, so
 * every color gets used roughly equally no matter how the heights are distributed.
 */
export function assignBands(heights: number[], values: ParamValues): number[] {
  const n = bandColors(values).length
  const mode = (values.colorMode as ColorMode) ?? 'height'
  if (n === 1 || mode === 'single') return heights.map(() => 0)
  if (mode === 'random') {
    const seed = Number(values.seed ?? 1)
    return heights.map((_, i) => Math.min(n - 1, Math.floor(hash01(i, seed) * n)))
  }
  // Rank-based, but equal heights share a band (many OSM buildings have the same default height).
  const order = heights.map((h, i) => [h, i] as const).sort((a, b) => a[0] - b[0])
  const bands = new Array<number>(heights.length).fill(0)
  let groupStart = 0
  order.forEach(([h, idx], rank) => {
    if (rank > 0 && h !== order[rank - 1][0]) groupStart = rank
    bands[idx] = Math.min(n - 1, Math.floor((groupStart / Math.max(1, heights.length)) * n))
  })
  return bands
}

import { buildRevolveShell } from '../engine/revolveShell'
import type { ParamDef, ParamValues, ShapeDefinition } from '../engine/types'
import { colorParam, num } from './paramHelpers'

const curveStyleParam = (def: string): ParamDef => ({
  type: 'select',
  key: 'curveStyle',
  label: 'Profile curve',
  default: def,
  options: [
    { value: 'straight', label: 'Straight taper' },
    { value: 'bulge', label: 'Bulge outward' },
    { value: 'cinch', label: 'Cinch inward' },
    { value: 'sketch', label: 'Custom sketch (draw or upload)' },
  ],
})

/** Flat cylinder — the safe fallback before a sketch has been drawn/uploaded. */
export const DEFAULT_SKETCH_PROFILE: number[] = new Array(48).fill(1)

const crossSectionStyleParam = (def: string): ParamDef => ({
  type: 'select',
  key: 'crossSectionStyle',
  label: 'Cross-section',
  default: def,
  options: [
    { value: 'circle', label: 'Circle' },
    { value: 'superformula', label: 'Superformula (flower/star/gear)' },
  ],
})

const textureStyleParam = (def: string): ParamDef => ({
  type: 'select',
  key: 'textureStyle',
  label: 'Surface texture',
  default: def,
  options: [
    { value: 'none', label: 'Smooth' },
    { value: 'ribs', label: 'Ribs / flutes' },
    { value: 'waves', label: 'Waves' },
    { value: 'organic', label: 'Organic / coral' },
  ],
})

const perforationStyleParam = (def: string): ParamDef => ({
  type: 'select',
  key: 'perforationStyle',
  label: 'Perforation (cut-through holes)',
  default: def,
  options: [
    { value: 'none', label: 'None (solid wall)' },
    { value: 'hexagon', label: 'Honeycomb (hexagons)' },
    { value: 'circle', label: 'Circle punch' },
  ],
})

const textureActive = (v: ParamValues) => v.textureStyle !== 'none'
const isWaves = (v: ParamValues) => v.textureStyle === 'waves'
const isSketch = (v: ParamValues) => v.curveStyle === 'sketch'
const isCurved = (v: ParamValues) => v.curveStyle !== 'straight' && !isSketch(v)
const isSuperformula = (v: ParamValues) => v.crossSectionStyle === 'superformula'
const isPerforated = (v: ParamValues) => v.perforationStyle !== 'none'

const HEIGHT_SEGMENTS = 48

interface StandardParamConfig {
  height: [number, number, number, number]
  bottomLabel: string
  bottomDiameter: [number, number, number, number]
  topLabel: string
  topDiameter: [number, number, number, number]
  curveStyleDefault: string
  curveAmount: [number, number, number, number]
  twist: [number, number, number, number]
  crossSectionStyleDefault?: string
  sfM?: [number, number, number, number]
  sfN1?: [number, number, number, number]
  sfN2?: [number, number, number, number]
  sfN3?: [number, number, number, number]
  textureStyleDefault: string
  textureAmount: [number, number, number, number]
  textureFrequency: [number, number, number, number]
  textureSpiral: [number, number, number, number]
  perforationStyleDefault?: string
  perforationCellSize?: [number, number, number, number]
  perforationHoleRatio?: [number, number, number, number]
  wallThickness: [number, number, number, number]
  sides: [number, number, number, number]
  color: string
}

function standardParams(cfg: StandardParamConfig): ParamDef[] {
  return [
    num('height', 'Height', ...cfg.height),
    num('bottomDiameter', cfg.bottomLabel, ...cfg.bottomDiameter, 'mm', (v) => !isSketch(v)),
    num('topDiameter', cfg.topLabel, ...cfg.topDiameter, 'mm', (v) => !isSketch(v)),
    curveStyleParam(cfg.curveStyleDefault),
    num('curveAmount', 'Curve amount', ...cfg.curveAmount, 'mm', isCurved),
    num('sketchScale', 'Sketch max radius', 10, 300, 2, Math.max(cfg.bottomDiameter[3], cfg.topDiameter[3]) / 2, 'mm', isSketch),
    num('twist', 'Twist', ...cfg.twist, 'deg'),
    crossSectionStyleParam(cfg.crossSectionStyleDefault ?? 'circle'),
    num('sfM', 'Petals / points', ...(cfg.sfM ?? [2, 20, 1, 5]), '', isSuperformula),
    num('sfN1', 'Superformula n1', ...(cfg.sfN1 ?? [0.1, 40, 0.1, 0.5]), '', isSuperformula),
    num('sfN2', 'Superformula n2', ...(cfg.sfN2 ?? [0.1, 40, 0.1, 1.7]), '', isSuperformula),
    num('sfN3', 'Superformula n3', ...(cfg.sfN3 ?? [0.1, 40, 0.1, 1.7]), '', isSuperformula),
    textureStyleParam(cfg.textureStyleDefault),
    num('textureAmount', 'Texture depth', ...cfg.textureAmount, 'mm', textureActive),
    num('textureFrequency', 'Texture count', ...cfg.textureFrequency, '', textureActive),
    num('textureSpiral', 'Texture spiral', ...cfg.textureSpiral, '', isWaves),
    perforationStyleParam(cfg.perforationStyleDefault ?? 'none'),
    num('perforationCellSize', 'Hole spacing', ...(cfg.perforationCellSize ?? [8, 40, 1, 16]), 'mm', isPerforated),
    num('perforationHoleRatio', 'Hole size', ...(cfg.perforationHoleRatio ?? [0.3, 0.95, 0.05, 0.75]), '', isPerforated),
    num('wallThickness', 'Wall thickness', ...cfg.wallThickness),
    num('sides', 'Smoothness', ...cfg.sides, ''),
    colorParam(cfg.color),
  ]
}

function buildFromValues(values: ParamValues, bottomMode: 'open' | 'solid', topMode: 'open' | 'solid') {
  return buildRevolveShell({
    height: Number(values.height),
    bottomDiameter: Number(values.bottomDiameter),
    topDiameter: Number(values.topDiameter),
    curveStyle: values.curveStyle as 'straight' | 'bulge' | 'cinch' | 'sketch',
    curveAmount: Number(values.curveAmount),
    sketchProfile: Array.isArray(values.sketchProfile) && values.sketchProfile.length > 1
      ? (values.sketchProfile as number[])
      : DEFAULT_SKETCH_PROFILE,
    sketchScale: Number(values.sketchScale ?? 100),
    twist: Number(values.twist),
    crossSectionStyle: values.crossSectionStyle as 'circle' | 'superformula',
    sfM: Number(values.sfM),
    sfN1: Number(values.sfN1),
    sfN2: Number(values.sfN2),
    sfN3: Number(values.sfN3),
    textureStyle: values.textureStyle as 'none' | 'ribs' | 'waves' | 'organic',
    textureAmount: Number(values.textureAmount),
    textureFrequency: Number(values.textureFrequency),
    textureSpiral: Number(values.textureSpiral),
    perforation: {
      style: (values.perforationStyle as 'none' | 'hexagon' | 'circle') ?? 'none',
      cellSize: Number(values.perforationCellSize ?? 16),
      holeRatio: Number(values.perforationHoleRatio ?? 0.75),
    },
    wallThickness: Number(values.wallThickness),
    sides: Number(values.sides),
    heightSegments: HEIGHT_SEGMENTS,
    bottomMode,
    topMode,
  })
}

export const lampShade: ShapeDefinition = {
  id: 'lamp-shade',
  name: 'Lamp Shade',
  description: 'An open-ended revolved shade. Light passes through top and bottom.',
  params: standardParams({
    height: [80, 400, 5, 220],
    bottomLabel: 'Bottom diameter',
    bottomDiameter: [80, 500, 5, 220],
    topLabel: 'Top diameter',
    topDiameter: [40, 400, 5, 140],
    curveStyleDefault: 'straight',
    curveAmount: [0, 80, 1, 0],
    twist: [-360, 360, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 15, 0.5, 0],
    textureFrequency: [1, 60, 1, 12],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1, 6, 0.2, 2],
    sides: [6, 128, 1, 64],
    color: '#f5e6c8',
  }),
  build: (values) => buildFromValues(values, 'open', 'open'),
}

export const vase: ShapeDefinition = {
  id: 'vase',
  name: 'Vase',
  description: 'A solid-bottomed, open-top vessel. Holds water.',
  params: standardParams({
    height: [80, 400, 5, 240],
    bottomLabel: 'Base diameter',
    bottomDiameter: [40, 260, 5, 110],
    topLabel: 'Opening diameter',
    topDiameter: [30, 260, 5, 90],
    curveStyleDefault: 'bulge',
    curveAmount: [0, 100, 1, 30],
    twist: [-360, 360, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 15, 0.5, 0],
    textureFrequency: [1, 60, 1, 16],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1, 6, 0.2, 2.4],
    sides: [6, 128, 1, 72],
    color: '#8fb7a8',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const planter: ShapeDefinition = {
  id: 'planter',
  name: 'Planter / Pot',
  description: 'A sturdy, wide-mouthed pot with a solid base.',
  params: standardParams({
    height: [60, 300, 5, 150],
    bottomLabel: 'Base diameter',
    bottomDiameter: [60, 400, 5, 140],
    topLabel: 'Rim diameter',
    topDiameter: [60, 400, 5, 180],
    curveStyleDefault: 'straight',
    curveAmount: [0, 80, 1, 0],
    twist: [-180, 180, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 15, 0.5, 0],
    textureFrequency: [1, 60, 1, 12],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1.5, 8, 0.2, 3],
    sides: [5, 128, 1, 56],
    color: '#c96a4b',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const tumbler: ShapeDefinition = {
  id: 'tumbler',
  name: 'Tumbler / Cup',
  description: 'A drinkware-scale vessel. Try low "smoothness" for a faceted look.',
  params: standardParams({
    height: [60, 180, 5, 110],
    bottomLabel: 'Base diameter',
    bottomDiameter: [50, 120, 5, 75],
    topLabel: 'Rim diameter',
    topDiameter: [50, 130, 5, 82],
    curveStyleDefault: 'straight',
    curveAmount: [0, 40, 1, 0],
    twist: [-180, 180, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 10, 0.5, 0],
    textureFrequency: [1, 40, 1, 10],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1.5, 6, 0.2, 2.5],
    sides: [5, 128, 1, 64],
    color: '#4a6fa5',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const twistedSpire: ShapeDefinition = {
  id: 'twisted-spire',
  name: 'Twisted Spire',
  description: 'A faceted, spiraling sculptural form. Great as a candle holder or pen pot.',
  params: standardParams({
    height: [100, 400, 5, 260],
    bottomLabel: 'Base diameter',
    bottomDiameter: [40, 200, 5, 90],
    topLabel: 'Top diameter',
    topDiameter: [20, 180, 5, 55],
    curveStyleDefault: 'straight',
    curveAmount: [0, 60, 1, 0],
    twist: [-720, 720, 5, 240],
    textureStyleDefault: 'none',
    textureAmount: [0, 12, 0.5, 0],
    textureFrequency: [1, 40, 1, 8],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1, 5, 0.2, 1.8],
    sides: [3, 64, 1, 7],
    color: '#b892d6',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const waveBowl: ShapeDefinition = {
  id: 'wave-bowl',
  name: 'Wave Bowl',
  description: 'A wide, shallow dish with a rippling, fluted rim.',
  params: standardParams({
    height: [30, 150, 5, 70],
    bottomLabel: 'Base diameter',
    bottomDiameter: [40, 200, 5, 80],
    topLabel: 'Rim diameter',
    topDiameter: [120, 500, 5, 280],
    curveStyleDefault: 'bulge',
    curveAmount: [0, 60, 1, 15],
    twist: [-180, 180, 5, 0],
    textureStyleDefault: 'waves',
    textureAmount: [0, 25, 0.5, 10],
    textureFrequency: [2, 40, 1, 9],
    textureSpiral: [0, 8, 0.5, 1.5],
    wallThickness: [1.5, 8, 0.2, 2.5],
    sides: [8, 160, 1, 96],
    color: '#5aa9a3',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const organicPod: ShapeDefinition = {
  id: 'organic-pod',
  name: 'Organic Pod',
  description: 'A closed, coral/seed-pod-like sculptural form. Not a container — fully sealed.',
  params: standardParams({
    height: [60, 300, 5, 160],
    bottomLabel: 'Base diameter',
    bottomDiameter: [10, 200, 5, 30],
    topLabel: 'Top diameter',
    topDiameter: [10, 200, 5, 30],
    curveStyleDefault: 'bulge',
    curveAmount: [0, 100, 1, 55],
    twist: [-360, 360, 5, 60],
    textureStyleDefault: 'organic',
    textureAmount: [0, 20, 0.5, 6],
    textureFrequency: [1, 20, 0.5, 5],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1, 5, 0.2, 2],
    sides: [8, 128, 1, 80],
    color: '#e0824a',
  }),
  build: (values) => buildFromValues(values, 'solid', 'solid'),
}

export const flowerVase: ShapeDefinition = {
  id: 'flower-vase',
  name: 'Flower Vase',
  description:
    'A vase whose cross-section is a Gielis superformula curve instead of a circle — petals, not a circle. Tune "petals" and n1/n2/n3 for wildly different blooms.',
  params: standardParams({
    height: [80, 350, 5, 220],
    bottomLabel: 'Base diameter',
    bottomDiameter: [50, 220, 5, 90],
    topLabel: 'Opening diameter',
    topDiameter: [40, 220, 5, 70],
    curveStyleDefault: 'bulge',
    curveAmount: [0, 90, 1, 25],
    twist: [-360, 360, 5, 30],
    crossSectionStyleDefault: 'superformula',
    sfM: [2, 20, 1, 5],
    sfN1: [0.1, 40, 0.1, 0.6],
    sfN2: [0.1, 40, 0.1, 1.6],
    sfN3: [0.1, 40, 0.1, 1.6],
    textureStyleDefault: 'none',
    textureAmount: [0, 10, 0.5, 0],
    textureFrequency: [1, 40, 1, 10],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1, 5, 0.2, 2],
    sides: [24, 200, 2, 120],
    color: '#e8a1c4',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const gearPlanter: ShapeDefinition = {
  id: 'gear-planter',
  name: 'Gear Planter',
  description: 'A planter with a toothed, mechanical superformula cross-section — cogs, not curves.',
  params: standardParams({
    height: [60, 260, 5, 140],
    bottomLabel: 'Base diameter',
    bottomDiameter: [60, 350, 5, 140],
    topLabel: 'Rim diameter',
    topDiameter: [60, 350, 5, 170],
    curveStyleDefault: 'straight',
    curveAmount: [0, 60, 1, 0],
    twist: [-90, 90, 5, 0],
    crossSectionStyleDefault: 'superformula',
    sfM: [3, 24, 1, 10],
    sfN1: [0.1, 40, 0.1, 14],
    sfN2: [0.1, 40, 0.1, 3],
    sfN3: [0.1, 40, 0.1, 3],
    textureStyleDefault: 'none',
    textureAmount: [0, 10, 0.5, 0],
    textureFrequency: [1, 40, 1, 10],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [1.5, 8, 0.2, 3],
    sides: [40, 240, 2, 160],
    color: '#7a8b99',
  }),
  build: (values) => buildFromValues(values, 'solid', 'open'),
}

export const lampBase: ShapeDefinition = {
  id: 'lamp-base',
  name: 'Lamp Base',
  description:
    'A hollow, weighted base for a table lamp. The open top is sized for a standard socket/harp riser (~28-32mm); the open bottom routes the cord and lets you add sand or a coin weight for stability. Draw a custom profile with "Custom sketch" if you have a shape in mind.',
  params: standardParams({
    height: [120, 320, 5, 200],
    bottomLabel: 'Base diameter',
    bottomDiameter: [80, 220, 5, 140],
    topLabel: 'Socket opening diameter',
    topDiameter: [20, 60, 1, 32],
    curveStyleDefault: 'bulge',
    curveAmount: [0, 80, 1, 30],
    twist: [-180, 180, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 15, 0.5, 0],
    textureFrequency: [1, 40, 1, 12],
    textureSpiral: [0, 6, 0.5, 1],
    wallThickness: [2, 8, 0.2, 3.5],
    sides: [6, 160, 1, 72],
    color: '#c9a876',
  }),
  build: (values) => buildFromValues(values, 'open', 'open'),
}

export const honeycombLampShade: ShapeDefinition = {
  id: 'honeycomb-lamp-shade',
  name: 'Honeycomb Lamp Shade',
  description:
    'A lamp shade with real cut-through hexagonal holes (not just a bump texture) — light shines straight through the honeycomb pattern. Built with boolean CSG, so it costs a moment to regenerate after you change a slider.',
  params: standardParams({
    height: [100, 350, 5, 220],
    bottomLabel: 'Bottom diameter',
    bottomDiameter: [80, 400, 5, 200],
    topLabel: 'Top diameter',
    topDiameter: [60, 350, 5, 150],
    curveStyleDefault: 'straight',
    curveAmount: [0, 60, 1, 0],
    twist: [-180, 180, 5, 0],
    textureStyleDefault: 'none',
    textureAmount: [0, 10, 0.5, 0],
    textureFrequency: [1, 40, 1, 10],
    textureSpiral: [0, 6, 0.5, 1],
    perforationStyleDefault: 'hexagon',
    perforationCellSize: [10, 40, 1, 18],
    perforationHoleRatio: [0.3, 0.95, 0.05, 0.8],
    wallThickness: [2, 6, 0.2, 3],
    sides: [24, 160, 1, 96],
    color: '#e8dcc4',
  }),
  build: (values) => buildFromValues(values, 'open', 'open'),
}

export const revolveShapes: ShapeDefinition[] = [
  lampShade,
  lampBase,
  honeycombLampShade,
  vase,
  planter,
  tumbler,
  twistedSpire,
  waveBowl,
  organicPod,
  flowerVase,
  gearPlanter,
]

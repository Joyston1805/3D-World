import { buildRevolveShell } from '../engine/revolveShell'
import type { ComponentGroup, ParamDef, ParamValues, ShapeDefinition } from '../engine/types'
import { defaultValuesFor } from '../engine/types'
import { colorParam, num } from './paramHelpers'

/** Flat cylinder — the safe fallback before a sketch has been drawn/uploaded. */
export const DEFAULT_SKETCH_PROFILE: number[] = new Array(48).fill(1)

const modeParam = (key: string, label: string, def: 'open' | 'solid'): ParamDef => ({
  type: 'select',
  key,
  label,
  default: def,
  options: [
    { value: 'open', label: 'Open' },
    { value: 'solid', label: 'Solid' },
  ],
})

const curveStyleParam: ParamDef = {
  type: 'select',
  key: 'curveStyle',
  label: 'Curve style',
  default: 'straight',
  options: [
    { value: 'straight', label: 'Straight taper' },
    { value: 'bulge', label: 'Bulge outward' },
    { value: 'cinch', label: 'Cinch inward' },
    { value: 'sketch', label: 'Custom sketch (draw or upload)' },
  ],
}

const crossSectionStyleParam: ParamDef = {
  type: 'select',
  key: 'crossSectionStyle',
  label: 'Cross-section style',
  default: 'circle',
  options: [
    { value: 'circle', label: 'Circle' },
    { value: 'superformula', label: 'Superformula (flower/star/gear)' },
  ],
}

const textureStyleParam: ParamDef = {
  type: 'select',
  key: 'textureStyle',
  label: 'Texture style',
  default: 'none',
  options: [
    { value: 'ribs', label: 'Ribs / flutes' },
    { value: 'waves', label: 'Waves' },
    { value: 'organic', label: 'Organic / coral' },
  ],
}

const perforationStyleParam: ParamDef = {
  type: 'select',
  key: 'perforationStyle',
  label: 'Hole pattern',
  default: 'none',
  options: [
    { value: 'hexagon', label: 'Honeycomb (hexagons)' },
    { value: 'circle', label: 'Circle punch' },
  ],
}

const isSketch = (v: ParamValues) => v.curveStyle === 'sketch'
const isCurved = (v: ParamValues) => v.curveStyle !== 'straight' && !isSketch(v)
const isSuperformula = (v: ParamValues) => v.crossSectionStyle === 'superformula'
const isWaves = (v: ParamValues) => v.textureStyle === 'waves'

const HEIGHT_SEGMENTS = 48

/** Params every revolve shape always has, regardless of which components are active. */
const coreParams: ParamDef[] = [
  num('height', 'Height', 20, 500, 5, 150),
  num('bottomDiameter', 'Bottom diameter', 10, 500, 5, 120),
  num('topDiameter', 'Top diameter', 10, 500, 5, 120),
  modeParam('bottomMode', 'Bottom', 'solid'),
  modeParam('topMode', 'Top', 'open'),
  num('wallThickness', 'Wall thickness', 1, 10, 0.2, 2.5),
  num('sides', 'Smoothness', 3, 200, 1, 64, ''),
  colorParam('#b5b5b5'),
]

const profileCurveParams: ParamDef[] = [
  curveStyleParam,
  num('curveAmount', 'Curve amount', 0, 150, 1, 0, 'mm', isCurved),
  num('sketchScale', 'Sketch max radius', 10, 300, 2, 80, 'mm', isSketch),
]

const crossSectionParams: ParamDef[] = [
  crossSectionStyleParam,
  num('sfM', 'Petals / points', 2, 24, 1, 6, '', isSuperformula),
  num('sfN1', 'Superformula n1', 0.1, 40, 0.1, 0.6, '', isSuperformula),
  num('sfN2', 'Superformula n2', 0.1, 40, 0.1, 1.7, '', isSuperformula),
  num('sfN3', 'Superformula n3', 0.1, 40, 0.1, 1.7, '', isSuperformula),
]

const twistParams: ParamDef[] = [num('twist', 'Twist amount', -720, 720, 5, 0, 'deg')]

const textureParams: ParamDef[] = [
  textureStyleParam,
  num('textureAmount', 'Texture depth', 0.5, 25, 0.5, 6),
  num('textureFrequency', 'Texture count', 1, 60, 1, 12, ''),
  num('textureSpiral', 'Texture spiral', 0, 8, 0.5, 1.5, '', isWaves),
]

const perforationParams: ParamDef[] = [
  perforationStyleParam,
  num('perforationCellSize', 'Hole spacing', 6, 50, 1, 16, 'mm'),
  num('perforationHoleRatio', 'Hole size', 0.3, 0.95, 0.05, 0.75),
]

function paramKeysOf(defs: ParamDef[]): string[] {
  return defs.map((d) => d.key)
}

export const componentGroups: ComponentGroup[] = [
  {
    id: 'profileCurve',
    label: 'Profile Curve',
    description: 'Shape the silhouette: bulge, cinch, or a hand-drawn/uploaded custom profile.',
    paramKeys: paramKeysOf(profileCurveParams),
    isActive: (v) => v.curveStyle !== 'straight',
    activate: (v) => ({ ...v, curveStyle: 'bulge', curveAmount: v.curveAmount && Number(v.curveAmount) > 0 ? v.curveAmount : 35 }),
    deactivate: (v) => ({ ...v, curveStyle: 'straight', curveAmount: 0 }),
  },
  {
    id: 'crossSection',
    label: 'Cross-Section Shape',
    description: 'Replace the circular cross-section with a superformula curve — flowers, stars, gears.',
    paramKeys: paramKeysOf(crossSectionParams),
    isActive: (v) => v.crossSectionStyle === 'superformula',
    activate: (v) => ({ ...v, crossSectionStyle: 'superformula' }),
    deactivate: (v) => ({ ...v, crossSectionStyle: 'circle' }),
  },
  {
    id: 'twist',
    label: 'Twist',
    description: 'Spiral the whole form top-to-bottom.',
    paramKeys: paramKeysOf(twistParams),
    isActive: (v) => Number(v.twist) !== 0,
    activate: (v) => ({ ...v, twist: 90 }),
    deactivate: (v) => ({ ...v, twist: 0 }),
  },
  {
    id: 'texture',
    label: 'Surface Texture',
    description: 'Ribs/flutes, waves, or organic noise displacing the surface.',
    paramKeys: paramKeysOf(textureParams),
    isActive: (v) => v.textureStyle !== 'none',
    activate: (v) => ({ ...v, textureStyle: 'ribs' }),
    deactivate: (v) => ({ ...v, textureStyle: 'none' }),
  },
  {
    id: 'perforation',
    label: 'Perforation',
    description: 'Real cut-through holes (honeycomb or circle-punch) via boolean CSG — not just a bump.',
    paramKeys: paramKeysOf(perforationParams),
    isActive: (v) => v.perforationStyle !== 'none',
    activate: (v) => ({ ...v, perforationStyle: 'hexagon' }),
    deactivate: (v) => ({ ...v, perforationStyle: 'none' }),
  },
]

const allParams: ParamDef[] = [
  ...coreParams,
  ...profileCurveParams,
  ...crossSectionParams,
  ...twistParams,
  ...textureParams,
  ...perforationParams,
]

function build(values: ParamValues) {
  return buildRevolveShell({
    height: Number(values.height),
    bottomDiameter: Number(values.bottomDiameter),
    topDiameter: Number(values.topDiameter),
    curveStyle: values.curveStyle as 'straight' | 'bulge' | 'cinch' | 'sketch',
    curveAmount: Number(values.curveAmount),
    sketchProfile:
      Array.isArray(values.sketchProfile) && values.sketchProfile.length > 1
        ? (values.sketchProfile as number[])
        : DEFAULT_SKETCH_PROFILE,
    sketchScale: Number(values.sketchScale ?? 100),
    twist: Number(values.twist),
    crossSectionStyle: values.crossSectionStyle as 'circle' | 'superformula',
    sfM: Number(values.sfM),
    sfN1: Number(values.sfN1),
    sfN2: Number(values.sfN2),
    sfN3: Number(values.sfN3),
    textureStyle: (values.textureStyle as 'none' | 'ribs' | 'waves' | 'organic') ?? 'none',
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
    bottomMode: (values.bottomMode as 'open' | 'solid') ?? 'solid',
    topMode: (values.topMode as 'open' | 'solid') ?? 'open',
  })
}

export const revolveDefaults: ParamValues = defaultValuesFor(allParams)

export const revolve: ShapeDefinition = {
  id: 'revolve',
  name: 'Revolve',
  description:
    'A 2D profile spun around an axis — the mathematical base behind vases, shades, bowls, pots, and cups. Starts as a plain cylinder; add components below to shape it further.',
  params: allParams,
  componentGroups,
  build,
}

export const revolveShapes: ShapeDefinition[] = [revolve]

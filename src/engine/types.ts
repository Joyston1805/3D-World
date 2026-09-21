import type * as THREE from 'three'

export interface NumberParam {
  type: 'number'
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
  /** Only render this control when the predicate over current values is true. */
  showIf?: (values: ParamValues) => boolean
}

export interface SelectParam {
  type: 'select'
  key: string
  label: string
  options: { value: string; label: string }[]
  default: string
  showIf?: (values: ParamValues) => boolean
}

export interface ColorParam {
  type: 'color'
  key: string
  label: string
  default: string
  showIf?: (values: ParamValues) => boolean
}

export interface BooleanParam {
  type: 'boolean'
  key: string
  label: string
  default: boolean
  showIf?: (values: ParamValues) => boolean
}

export type ParamDef = NumberParam | SelectParam | ColorParam | BooleanParam

/** Row-major grayscale brightness grid (0=black..1=white) sampled from an uploaded image. */
export interface Heightmap {
  data: Float32Array
  cols: number
  rows: number
}

/**
 * number[]/Heightmap values are never produced by a ParamDef slider — they're written
 * directly by a custom UI component (e.g. SketchPad, ImageUploadControl) via the same
 * setParam channel, and read back out by a shape's build() function. The generic
 * ParamPanel renderer never iterates over them since no ParamDef declares that type.
 */
export type ParamValues = Record<string, number | string | boolean | number[] | Heightmap>

/**
 * An addable/removable feature layer within a shape (e.g. "Twist", "Perforation").
 * Lets a base shape be built up dynamically — start plain, add components, customize —
 * instead of picking a whole pre-baked shape identity.
 */
export interface ComponentGroup {
  id: string
  label: string
  description: string
  /** Param keys owned by this component; hidden/shown together as a unit. */
  paramKeys: string[]
  isActive: (values: ParamValues) => boolean
  /** Patch applied when the user clicks "+ Add" — sets it to a sensible non-neutral state. */
  activate: (values: ParamValues) => ParamValues
  /** Patch applied when the user clicks "Remove" — resets to the neutral/off state. */
  deactivate: (values: ParamValues) => ParamValues
}

/** A named starting point (a preset bundle of param values) for a base shape. */
export interface ShapeTemplate {
  id: string
  name: string
  description: string
  values: ParamValues
}

export interface ShapeDefinition {
  id: string
  name: string
  description: string
  params: ParamDef[]
  build: (values: ParamValues) => THREE.BufferGeometry
  /** Toggleable feature layers, for shapes built dynamically (see ComponentGroup). */
  componentGroups?: ComponentGroup[]
}

export function defaultValuesFor(params: ParamDef[]): ParamValues {
  const values: ParamValues = {}
  for (const p of params) values[p.key] = p.default
  return values
}

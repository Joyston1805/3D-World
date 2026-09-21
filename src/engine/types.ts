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

/**
 * number[] values are never produced by a ParamDef slider — they're written directly
 * by a custom UI component (e.g. SketchPad) via the same setParam channel, and read
 * back out by a shape's build() function. The generic ParamPanel renderer never
 * iterates over them since no ParamDef declares that type.
 */
export type ParamValues = Record<string, number | string | boolean | number[]>

export interface ShapeDefinition {
  id: string
  name: string
  description: string
  params: ParamDef[]
  build: (values: ParamValues) => THREE.BufferGeometry
}

export function defaultValuesFor(params: ParamDef[]): ParamValues {
  const values: ParamValues = {}
  for (const p of params) values[p.key] = p.default
  return values
}

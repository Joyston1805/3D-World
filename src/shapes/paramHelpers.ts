import type { ParamDef, ParamValues } from '../engine/types'

export const num = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  def: number,
  unit = 'mm',
  showIf?: (values: ParamValues) => boolean,
): ParamDef => ({ type: 'number', key, label, min, max, step, default: def, unit, showIf })

export const colorParam = (def: string): ParamDef => ({ type: 'color', key: 'color', label: 'Color', default: def })

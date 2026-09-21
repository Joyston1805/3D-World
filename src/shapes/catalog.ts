import type { ShapeDefinition } from '../engine/types'
import { blobShapes } from './blobShapes'
import { branchShapes } from './branchShapes'
import { lithophaneShapes } from './lithophaneShapes'
import { revolveShapes } from './revolveShapes'

export const shapeCatalog: ShapeDefinition[] = [
  ...revolveShapes,
  ...blobShapes,
  ...branchShapes,
  ...lithophaneShapes,
]

export function getShape(id: string): ShapeDefinition | undefined {
  return shapeCatalog.find((s) => s.id === id)
}

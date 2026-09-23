import type { ShapeDefinition, ShapeTemplate } from '../engine/types'
import { blobShapes } from './blobShapes'
import { blobTemplates } from './blobTemplates'
import { branchShapes } from './branchShapes'
import { lithophaneShapes } from './lithophaneShapes'
import { revolveShapes } from './revolveShapes'
import { revolveTemplates } from './revolveTemplates'
import { terrainShapes } from './terrainShapes'

export const shapeCatalog: ShapeDefinition[] = [
  ...revolveShapes,
  ...blobShapes,
  ...branchShapes,
  ...lithophaneShapes,
  ...terrainShapes,
]

/** Named starting points ("quick start" presets) per base shape id, if any. */
export const templatesByShapeId: Record<string, ShapeTemplate[]> = {
  revolve: revolveTemplates,
  blob: blobTemplates,
}

export function getShape(id: string): ShapeDefinition | undefined {
  return shapeCatalog.find((s) => s.id === id)
}

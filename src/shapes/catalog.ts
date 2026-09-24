import type { ShapeDefinition, ShapeTemplate } from '../engine/types'
import { blobShapes } from './blobShapes'
import { blobTemplates } from './blobTemplates'
import { branchShapes } from './branchShapes'
import { cityMapTemplates, cityscapeTemplates, cityShapes } from './cityShapes'
import { lithophaneShapes } from './lithophaneShapes'
import { revolveShapes } from './revolveShapes'
import { revolveTemplates } from './revolveTemplates'
import { terrainShapes, terrainTemplates } from './terrainShapes'

export const shapeCatalog: ShapeDefinition[] = [
  ...revolveShapes,
  ...blobShapes,
  ...branchShapes,
  ...lithophaneShapes,
  ...terrainShapes,
  ...cityShapes,
]

/** Named starting points ("quick start" presets) per base shape id, if any. */
export const templatesByShapeId: Record<string, ShapeTemplate[]> = {
  revolve: revolveTemplates,
  blob: blobTemplates,
  terrain: terrainTemplates,
  cityscape: cityscapeTemplates,
  citymap: cityMapTemplates,
}

export function getShape(id: string): ShapeDefinition | undefined {
  return shapeCatalog.find((s) => s.id === id)
}

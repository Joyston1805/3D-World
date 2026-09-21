import { create } from 'zustand'
import { defaultValuesFor } from '../engine/types'
import type { Heightmap, ParamValues } from '../engine/types'
import { getShape, shapeCatalog } from '../shapes/catalog'

interface DesignState {
  selectedShapeId: string
  valuesByShape: Record<string, ParamValues>
  selectShape: (id: string) => void
  setParam: (key: string, value: number | string | boolean | number[] | Heightmap) => void
  setParamsForShape: (shapeId: string, patch: ParamValues) => void
  resetShape: (id: string) => void
}

const initialValues: Record<string, ParamValues> = {}
for (const shape of shapeCatalog) {
  initialValues[shape.id] = defaultValuesFor(shape.params)
}

export const useDesignStore = create<DesignState>((set) => ({
  selectedShapeId: shapeCatalog[0].id,
  valuesByShape: initialValues,
  selectShape: (id) => set({ selectedShapeId: id }),
  setParam: (key, value) =>
    set((state) => ({
      valuesByShape: {
        ...state.valuesByShape,
        [state.selectedShapeId]: {
          ...state.valuesByShape[state.selectedShapeId],
          [key]: value,
        },
      },
    })),
  setParamsForShape: (shapeId, patch) =>
    set((state) => ({
      valuesByShape: {
        ...state.valuesByShape,
        [shapeId]: {
          ...state.valuesByShape[shapeId],
          ...patch,
        },
      },
    })),
  resetShape: (id) => {
    const shape = getShape(id)
    if (!shape) return
    set((state) => ({
      valuesByShape: {
        ...state.valuesByShape,
        [id]: defaultValuesFor(shape.params),
      },
    }))
  },
}))

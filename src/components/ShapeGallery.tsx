import { shapeCatalog } from '../shapes/catalog'
import { useDesignStore } from '../store/useDesignStore'

export function ShapeGallery() {
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const selectShape = useDesignStore((s) => s.selectShape)

  return (
    <div className="flex gap-2 overflow-x-auto p-3">
      {shapeCatalog.map((shape) => {
        const active = shape.id === selectedShapeId
        return (
          <button
            key={shape.id}
            onClick={() => selectShape(shape.id)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              active
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="font-medium">{shape.name}</div>
          </button>
        )
      })}
    </div>
  )
}

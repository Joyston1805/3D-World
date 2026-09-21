import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { AIGeneratePanel } from './components/AIGeneratePanel'
import { ParamPanel } from './components/ParamPanel'
import { ShapeGallery } from './components/ShapeGallery'
import { Viewer3D } from './components/Viewer3D'
import { downloadStl } from './lib/exportStl'
import { getShape } from './shapes/catalog'
import { useDesignStore } from './store/useDesignStore'

type Mode = 'parametric' | 'ai'

function App() {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const shape = getShape(selectedShapeId)

  const [mode, setMode] = useState<Mode>('parametric')
  const [rawGeneratedGeometry, setRawGeneratedGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [aiScaleMm, setAiScaleMm] = useState(100)

  const scaledGeneratedGeometry = useMemo(() => {
    if (!rawGeneratedGeometry) return null
    rawGeneratedGeometry.computeBoundingBox()
    const box = rawGeneratedGeometry.boundingBox
    const currentHeight = box ? box.max.y - box.min.y : 0
    if (currentHeight <= 0) return rawGeneratedGeometry
    const factor = aiScaleMm / currentHeight
    const geo = rawGeneratedGeometry.clone()
    geo.scale(factor, factor, factor)
    geo.computeBoundingBox()
    const scaledBox = geo.boundingBox
    if (scaledBox) geo.translate(0, -scaledBox.min.y, 0)
    return geo
  }, [rawGeneratedGeometry, aiScaleMm])

  const handleExport = () => {
    if (!meshRef.current) return
    const filename = mode === 'ai' ? `ai-generated-${Date.now()}.stl` : `${shape?.id ?? 'model'}-${Date.now()}.stl`
    downloadStl(meshRef.current, filename)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Formwork</h1>
          <p className="text-xs text-slate-500">Parametric 3D models, ready for your printer</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setMode('parametric')}
              className={`rounded px-3 py-1 ${mode === 'parametric' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Parametric Shapes
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`rounded px-3 py-1 ${mode === 'ai' ? 'bg-emerald-500 text-emerald-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              AI Generate
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={mode === 'ai' && !scaledGeneratedGeometry}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Export STL
          </button>
        </div>
      </header>

      {mode === 'parametric' && <ShapeGallery />}

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <Viewer3D meshRef={meshRef} generatedGeometry={mode === 'ai' ? scaledGeneratedGeometry : null} />
        </main>
        <aside className="w-72 shrink-0 border-l border-slate-800 bg-slate-925">
          {mode === 'parametric' ? (
            <ParamPanel />
          ) : (
            <AIGeneratePanel
              onGenerated={setRawGeneratedGeometry}
              hasResult={!!rawGeneratedGeometry}
              onClear={() => setRawGeneratedGeometry(null)}
              scaleMm={aiScaleMm}
              onScaleChange={setAiScaleMm}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

export default App

import { useRef } from 'react'
import type * as THREE from 'three'
import { ParamPanel } from './components/ParamPanel'
import { ShapeGallery } from './components/ShapeGallery'
import { Viewer3D } from './components/Viewer3D'
import { downloadStl } from './lib/exportStl'
import { getShape } from './shapes/catalog'
import { useDesignStore } from './store/useDesignStore'

// AI Generate (Meshy-backed) is built but paused — see "AI Generate (paused)" in
// README.md. Its pieces (server/, src/components/AIGeneratePanel.tsx,
// src/lib/aiGenerate.ts, Viewer3D's generatedGeometry prop) are untouched and ready
// to wire back in; this file just doesn't render the toggle for it right now.

function App() {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const shape = getShape(selectedShapeId)

  const handleExport = () => {
    if (!meshRef.current) return
    const filename = `${shape?.id ?? 'model'}-${Date.now()}.stl`
    downloadStl(meshRef.current, filename)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Formwork</h1>
          <p className="text-xs text-slate-500">Parametric 3D models, ready for your printer</p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
        >
          Export STL
        </button>
      </header>

      <ShapeGallery />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <Viewer3D meshRef={meshRef} />
        </main>
        <aside className="w-72 shrink-0 border-l border-slate-800 bg-slate-925">
          <ParamPanel />
        </aside>
      </div>
    </div>
  )
}

export default App

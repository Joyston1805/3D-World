import { useEffect, useState } from 'react'
import Module from 'manifold-3d'
import type { ManifoldToplevel } from 'manifold-3d'

/**
 * manifold-3d ships as a WASM module needing async init, but every shape's build()
 * is synchronous (Viewer3D calls it inside useMemo, verify-geometry.ts calls it
 * directly, etc.) — changing that contract would ripple through the whole app. So
 * instead: kick off loading once (call `ensureManifoldLoading()` on app start) and
 * degrade gracefully — perforation is skipped (shape renders solid) until the module
 * finishes loading, typically well under a second, after which the next recompute
 * picks it up automatically.
 */

let modulePromise: Promise<ManifoldToplevel> | null = null
let moduleInstance: ManifoldToplevel | null = null

export function ensureManifoldLoading(): Promise<ManifoldToplevel> {
  if (!modulePromise) {
    modulePromise = Module().then((wasm) => {
      wasm.setup()
      moduleInstance = wasm
      return wasm
    })
  }
  return modulePromise
}

export function getManifoldModule(): ManifoldToplevel | null {
  return moduleInstance
}

/** True once the WASM module has finished loading; triggers one re-render on flip. */
export function useManifoldReady(): boolean {
  const [ready, setReady] = useState(() => !!moduleInstance)
  useEffect(() => {
    if (ready) return
    let cancelled = false
    ensureManifoldLoading().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready])
  return ready
}

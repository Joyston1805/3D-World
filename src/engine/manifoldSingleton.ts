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

let modulePromise: Promise<ManifoldToplevel | void> | null = null
let moduleInstance: ManifoldToplevel | null = null

export function ensureManifoldLoading(): Promise<ManifoldToplevel | void> {
  if (!modulePromise) {
    modulePromise = Module()
      .then((wasm) => {
        wasm.setup()
        moduleInstance = wasm
        return wasm
      })
      .catch((err) => {
        // Without this catch, a load failure (flaky network, a restrictive CSP blocking
        // wasm-unsafe-eval, etc.) would leave this rejection uncaught all the way up —
        // an unhandled promise rejection in the console with no clue why perforation
        // silently never works. Graceful degradation (skip perforation) still happens
        // via getManifoldModule() returning null forever; this just makes the failure
        // visible and diagnosable instead of a silent, permanent no-op.
        console.error(
          '[manifold-3d] Failed to load the perforation engine — perforated shapes will render without cut holes. Reloading the page will retry.',
          err,
        )
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
      // Checks the actual instance, not just promise settlement — a caught load
      // failure above resolves (doesn't reject) but never sets moduleInstance, and
      // "ready" should mean "safe to expect getManifoldModule() to return non-null."
      if (!cancelled && moduleInstance) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready])
  return ready
}

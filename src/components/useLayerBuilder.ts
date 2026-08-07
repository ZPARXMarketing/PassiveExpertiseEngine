import { useCallback, useEffect, useRef } from 'react'
import { useApp } from '../state/AppContext'
import { generateLayer, layerContext, LayerUnavailableError, offlineLayer } from '../data/domain'
import type { DomainPath } from '../data/types'

/**
 * Build one layer of one path.
 *
 * Selecting a path and unlocking depth are the same operation from here: ask
 * the model for that layer's concepts, and fall back to the offline layer if
 * generation is unavailable, so a chosen path is always walkable. The reason
 * for any fallback is surfaced rather than swallowed.
 */
export function useLayerBuilder() {
  const { state, activeDomain, dispatch } = useApp()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const build = useCallback(
    async (path: DomainPath, layerIndex: number) => {
      if (!activeDomain || state.layerLoading) return

      const controller = new AbortController()
      abortRef.current = controller
      dispatch({ type: 'layerLoading', pathId: path.id })

      try {
        const built = await generateLayer({
          domain: activeDomain,
          path,
          layerIndex,
          settings: state.settings,
          signal: controller.signal,
        })
        dispatch({ type: 'layerBuilt', pathId: path.id, layerIndex, built })
      } catch (err) {
        if (controller.signal.aborted) return
        const message =
          err instanceof LayerUnavailableError ? err.message : 'Layer generation failed unexpectedly.'
        // A path the learner committed to must still open, so fall back to the
        // starter layer and say why it is generic.
        try {
          const built = offlineLayer(path, layerContext(activeDomain, path, layerIndex))
          dispatch({
            type: 'layerBuilt',
            pathId: path.id,
            layerIndex,
            built,
            message: 'Opened with the starter layer — AI design unavailable',
          })
          dispatch({ type: 'layerFailed', message })
        } catch {
          dispatch({ type: 'layerFailed', message })
        }
      }
    },
    [activeDomain, dispatch, state.layerLoading, state.settings],
  )

  return { build, loading: state.layerLoading, error: state.layerError }
}

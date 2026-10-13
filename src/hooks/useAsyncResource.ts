import { useCallback, useEffect, useState } from 'react'
import { describeError, isAbortError } from '../services/http'

export interface AsyncResource<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

interface State<T> {
  key: string | null
  data: T | null
  isLoading: boolean
  error: string | null
}

/**
 * Loads a secondary resource (air quality, radar index, comparison rows)
 * whenever `key` changes, cancelling the previous request. Pass a null key to
 * stay idle. `load` must be stable for a given key.
 */
export function useAsyncResource<T>(
  key: string | null,
  load: (signal: AbortSignal, force: boolean) => Promise<T>,
): AsyncResource<T> {
  const [state, setState] = useState<State<T>>({ key: null, data: null, isLoading: false, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    setState((previous) => ({
      key,
      data: previous.key === key ? previous.data : null,
      isLoading: true,
      error: null,
    }))
    load(controller.signal, attempt > 0)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, isLoading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState((previous) => ({ ...previous, isLoading: false, error: describeError(error) }))
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const current = state.key === key
  return {
    data: current ? state.data : null,
    isLoading: current ? state.isLoading : key !== null,
    error: current ? state.error : null,
    reload,
  }
}

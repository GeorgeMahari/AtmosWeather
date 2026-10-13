import { useEffect, useState } from 'react'
import { searchLocations } from '../services/geocodingApi'
import { describeError, isAbortError } from '../services/http'
import type { GeoLocation } from '../types/weatherTypes'

const DEBOUNCE_MS = 300
export const MIN_QUERY_LENGTH = 2

export interface LocationSearchState {
  results: GeoLocation[]
  status: 'idle' | 'loading' | 'done' | 'error'
  error: string | null
}

const IDLE: LocationSearchState = { results: [], status: 'idle', error: null }

/** Debounced geocoding autocomplete; stale requests are cancelled. */
export function useLocationSearch(query: string): LocationSearchState {
  const [state, setState] = useState<LocationSearchState & { query: string }>({ ...IDLE, query: '' })
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setState((previous) => ({ ...previous, status: 'loading', error: null, query: trimmed }))
      searchLocations(trimmed, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setState({ results, status: 'done', error: null, query: trimmed })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return
          setState({ results: [], status: 'error', error: describeError(error), query: trimmed })
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed])

  if (trimmed.length < MIN_QUERY_LENGTH) return IDLE
  // Until results for the *current* text arrive, show none: stale matches for
  // different text must never be selectable with Enter.
  if (state.query !== trimmed || state.status === 'loading') return { results: [], status: 'loading', error: null }
  return state
}

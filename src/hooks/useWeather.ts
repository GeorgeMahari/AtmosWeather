import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, isAbortError } from '../services/http'
import { FORECAST_TTL_MS, fetchForecast, peekForecast } from '../services/weatherApi'
import type { GeoLocation, WeatherData } from '../types/weatherTypes'

export interface WeatherState {
  /** Last successful forecast for the selected location (may be stale). */
  data: WeatherData | null
  /** First load with nothing to show yet. */
  isLoading: boolean
  /** A request is in flight while older data stays on screen. */
  isRefreshing: boolean
  /** Message from the most recent failed request, cleared on success. */
  error: string | null
  /** Wall-clock time of the last request attempt, successful or not. */
  lastAttemptAt: number | null
  refresh: () => void
}

interface Internal {
  locationId: string | null
  data: WeatherData | null
  isFetching: boolean
  error: string | null
  lastAttemptAt: number | null
}

const EMPTY: Internal = { locationId: null, data: null, isFetching: false, error: null, lastAttemptAt: null }

/**
 * Loads and keeps the forecast for one location up to date.
 *
 * Refresh policy (an application choice, not a statement about how often the
 * provider's models update): re-request every 10 minutes while the tab is
 * visible, immediately when the tab becomes visible or the network returns
 * with data older than that, and on demand.
 */
export function useWeather(location: GeoLocation | null): WeatherState {
  const [state, setState] = useState<Internal>(EMPTY)
  const controllerRef = useRef<AbortController | null>(null)
  const locationRef = useRef(location)

  const load = useCallback((target: GeoLocation, force: boolean) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState((previous) => {
      const sameLocation = previous.locationId === target.id
      return {
        locationId: target.id,
        // Show whatever we already hold for this place straight away.
        data: sameLocation ? previous.data : peekForecast(target),
        isFetching: true,
        error: sameLocation ? previous.error : null,
        lastAttemptAt: sameLocation ? previous.lastAttemptAt : null,
      }
    })

    fetchForecast(target, { signal: controller.signal, force })
      .then((data) => {
        if (controller.signal.aborted) return
        setState({ locationId: target.id, data, isFetching: false, error: null, lastAttemptAt: Date.now() })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        // Keep the previous data on screen; the UI marks it as stale.
        setState((previous) => ({
          ...previous,
          isFetching: false,
          error: describeError(error),
          lastAttemptAt: Date.now(),
        }))
      })
  }, [])

  const locationKey = location?.id ?? null
  useEffect(() => {
    locationRef.current = location
    if (!location) return
    load(location, false)
    return () => controllerRef.current?.abort()
    // `location` identity may change without the place changing; key on the id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey, load])

  // Periodic and opportunistic refresh.
  const fetchedAt = state.data?.fetchedAt ?? null
  useEffect(() => {
    if (!locationKey) return
    const refreshIfDue = () => {
      const target = locationRef.current
      if (!target || document.visibilityState !== 'visible' || !navigator.onLine) return
      if (fetchedAt === null || Date.now() - fetchedAt >= FORECAST_TTL_MS) load(target, true)
    }
    const interval = window.setInterval(refreshIfDue, 60_000)
    document.addEventListener('visibilitychange', refreshIfDue)
    window.addEventListener('online', refreshIfDue)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshIfDue)
      window.removeEventListener('online', refreshIfDue)
    }
  }, [locationKey, fetchedAt, load])

  const refresh = useCallback(() => {
    if (locationRef.current) load(locationRef.current, true)
  }, [load])

  const belongsToLocation = state.locationId === locationKey
  const data = belongsToLocation ? state.data : null
  const isFetching = belongsToLocation ? state.isFetching : locationKey !== null

  return {
    data,
    isLoading: isFetching && data === null,
    isRefreshing: isFetching && data !== null,
    error: belongsToLocation ? state.error : null,
    lastAttemptAt: belongsToLocation ? state.lastAttemptAt : null,
    refresh,
  }
}

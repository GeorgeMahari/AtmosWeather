import { useCallback, useEffect, useRef, useState } from 'react'
import { reverseGeocode } from '../services/geocodingApi'
import type { GeoLocation } from '../types/weatherTypes'

export interface GeolocationState {
  status: 'idle' | 'locating' | 'error'
  error: string | null
  /** Must be called from a user gesture — this is what triggers the permission prompt. */
  locate: () => void
  clearError: () => void
  supported: boolean
}

function describePositionError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. You can still search for any city.'
    case error.POSITION_UNAVAILABLE:
      return 'Your device could not determine its position. Try searching for a city instead.'
    case error.TIMEOUT:
      return 'Finding your position took too long. Try again or search for a city.'
    default:
      return 'Could not get your location.'
  }
}

export function useGeolocation(onLocated: (location: GeoLocation) => void): GeolocationState {
  const [status, setStatus] = useState<GeolocationState['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const mounted = useRef(true)
  const onLocatedRef = useRef(onLocated)

  useEffect(() => {
    onLocatedRef.current = onLocated
  }, [onLocated])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const locate = useCallback(() => {
    if (!supported) {
      setStatus('error')
      setError('This browser does not support geolocation. Search for a city instead.')
      return
    }
    setStatus('locating')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const location = await reverseGeocode(latitude, longitude).catch(() => null)
        if (!mounted.current) return
        setStatus('idle')
        if (location) onLocatedRef.current(location)
      },
      (positionError) => {
        if (!mounted.current) return
        setStatus('error')
        setError(describePositionError(positionError))
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    )
  }, [supported])

  const clearError = useCallback(() => {
    setError(null)
    setStatus('idle')
  }, [])

  return { status, error, locate, clearError, supported }
}

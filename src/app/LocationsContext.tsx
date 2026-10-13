import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { resolveDefaultLocation } from '../services/geocodingApi'
import type { GeoLocation } from '../types/weatherTypes'
import {
  STORAGE_KEYS,
  asLocation,
  asLocationList,
  locationFromUrl,
  locationToSearch,
  readStorage,
  writeStorage,
} from '../utils/storage'

const MAX_RECENTS = 6
const MAX_FAVORITES = 12
export const MAX_COMPARE = 4

interface LocationsContextValue {
  /** null only while the first-visit default is being resolved. */
  location: GeoLocation | null
  selectLocation: (location: GeoLocation) => void
  recents: GeoLocation[]
  clearRecents: () => void
  favorites: GeoLocation[]
  isFavorite: (id: string) => boolean
  toggleFavorite: (location: GeoLocation) => void
  compare: GeoLocation[]
  addCompare: (location: GeoLocation) => void
  removeCompare: (id: string) => void
  /** True when no location was stored or shared — used for the welcome prompt. */
  isFirstVisit: boolean
  dismissWelcome: () => void
}

const LocationsContext = createContext<LocationsContextValue | null>(null)

const without = (list: GeoLocation[], id: string) => list.filter((item) => item.id !== id)

export function LocationsProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<GeoLocation | null>(
    () => locationFromUrl(window.location.search) ?? readStorage(STORAGE_KEYS.location, asLocation),
  )
  const [recents, setRecents] = useState<GeoLocation[]>(() => readStorage(STORAGE_KEYS.recents, asLocationList) ?? [])
  const [favorites, setFavorites] = useState<GeoLocation[]>(
    () => readStorage(STORAGE_KEYS.favorites, asLocationList) ?? [],
  )
  const [compare, setCompare] = useState<GeoLocation[]>(() => readStorage(STORAGE_KEYS.compare, asLocationList) ?? [])
  const [isFirstVisit, setFirstVisit] = useState(
    () => location === null && readStorage(STORAGE_KEYS.welcomed, (v) => (v === true ? true : null)) !== true,
  )

  // First visit: pick a sensible default without asking for any permission.
  useEffect(() => {
    if (location !== null) return
    const controller = new AbortController()
    resolveDefaultLocation(controller.signal)
      .then((resolved) => setLocation((current) => current ?? resolved))
      .catch(() => undefined)
    return () => controller.abort()
  }, [location])

  useEffect(() => {
    if (!location) return
    writeStorage(STORAGE_KEYS.location, location)
    const search = locationToSearch(location)
    if (window.location.search !== search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`)
    }
    document.title = `${location.name} — Atmos Weather`
  }, [location])

  useEffect(() => writeStorage(STORAGE_KEYS.recents, recents), [recents])
  useEffect(() => writeStorage(STORAGE_KEYS.favorites, favorites), [favorites])
  useEffect(() => writeStorage(STORAGE_KEYS.compare, compare), [compare])

  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  const selectLocation = useCallback((next: GeoLocation) => {
    const previous = locationRef.current
    if (previous && previous.id !== next.id) {
      setRecents((list) => [previous, ...without(without(list, previous.id), next.id)].slice(0, MAX_RECENTS))
    }
    setLocation(next)
    // An explicit choice replaces the first-visit suggestion.
    setFirstVisit(false)
    writeStorage(STORAGE_KEYS.welcomed, true)
  }, [])

  const toggleFavorite = useCallback((target: GeoLocation) => {
    setFavorites((list) =>
      list.some((item) => item.id === target.id) ? without(list, target.id) : [target, ...list].slice(0, MAX_FAVORITES),
    )
  }, [])

  const addCompare = useCallback((target: GeoLocation) => {
    setCompare((list) => (list.some((item) => item.id === target.id) || list.length >= MAX_COMPARE ? list : [...list, target]))
  }, [])
  const removeCompare = useCallback((id: string) => setCompare((list) => without(list, id)), [])
  const clearRecents = useCallback(() => setRecents([]), [])
  const dismissWelcome = useCallback(() => {
    setFirstVisit(false)
    writeStorage(STORAGE_KEYS.welcomed, true)
  }, [])

  const value = useMemo<LocationsContextValue>(
    () => ({
      location,
      selectLocation,
      recents,
      clearRecents,
      favorites,
      isFavorite: (id) => favorites.some((item) => item.id === id),
      toggleFavorite,
      compare,
      addCompare,
      removeCompare,
      isFirstVisit,
      dismissWelcome,
    }),
    [location, selectLocation, recents, clearRecents, favorites, toggleFavorite, compare, addCompare, removeCompare, isFirstVisit, dismissWelcome],
  )

  return <LocationsContext.Provider value={value}>{children}</LocationsContext.Provider>
}

export function useLocations(): LocationsContextValue {
  const value = useContext(LocationsContext)
  if (!value) throw new Error('useLocations must be used inside LocationsProvider')
  return value
}

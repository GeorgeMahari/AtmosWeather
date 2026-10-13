import type { GeoLocation } from '../types/weatherTypes'
import { locationId } from './weatherTransformers'

/** Only lightweight preferences and location lists are stored client-side. */
export const STORAGE_KEYS = {
  settings: 'atmos:settings',
  location: 'atmos:location',
  recents: 'atmos:recents',
  favorites: 'atmos:favorites',
  compare: 'atmos:compare',
  welcomed: 'atmos:welcomed',
} as const

export function readStorage<T>(key: string, validate: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : validate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode / quota) — preferences just won't persist.
  }
}

export function asLocation(value: unknown): GeoLocation | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const { latitude, longitude, name } = v
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof name !== 'string' ||
    !name ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null
  }
  const str = (x: unknown) => (typeof x === 'string' && x ? x : undefined)
  return {
    id: locationId(latitude, longitude),
    name,
    admin1: str(v.admin1),
    country: str(v.country),
    countryCode: str(v.countryCode),
    latitude,
    longitude,
    timezone: str(v.timezone),
  }
}

export function asLocationList(value: unknown): GeoLocation[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    const location = asLocation(item)
    return location ? [location] : []
  })
}

// ---------------------------------------------------------------------------
// Shareable URLs: ?lat=44.4268&lon=26.1025&name=Bucharest&region=…&country=…
// ---------------------------------------------------------------------------

export function locationFromUrl(search: string): GeoLocation | null {
  const params = new URLSearchParams(search)
  const lat = params.get('lat')
  const lon = params.get('lon')
  if (lat === null || lon === null || lat.trim() === '' || lon.trim() === '') return null
  const latitude = Number(lat)
  const longitude = Number(lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return asLocation({
    latitude,
    longitude,
    name: params.get('name')?.slice(0, 80) || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    admin1: params.get('region')?.slice(0, 80),
    country: params.get('country')?.slice(0, 80),
  })
}

export function locationToSearch(location: GeoLocation): string {
  const params = new URLSearchParams({
    lat: location.latitude.toFixed(4),
    lon: location.longitude.toFixed(4),
    name: location.name,
  })
  if (location.admin1) params.set('region', location.admin1)
  if (location.country) params.set('country', location.country)
  return `?${params}`
}

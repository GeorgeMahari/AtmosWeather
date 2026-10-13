import type { GeoLocation } from '../types/weatherTypes'
import { locationId, parseGeocodingResponse } from '../utils/weatherTransformers'
import { RequestCache } from './cache'
import { fetchJson, withSignal } from './http'

/** https://open-meteo.com/en/docs/geocoding-api */
const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/**
 * Open-Meteo has no reverse geocoder, so naming a coordinate (device location,
 * map click) uses BigDataCloud's free client-side endpoint. It is optional:
 * if it fails the coordinates are still used, just with a generic label.
 */
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

const searchCache = new RequestCache<GeoLocation[]>({ ttlMs: 60 * 60_000 })

const language = () => (typeof navigator !== 'undefined' ? navigator.language.slice(0, 2).toLowerCase() : 'en')

export function searchLocations(query: string, signal?: AbortSignal, count = 8): Promise<GeoLocation[]> {
  const name = query.trim()
  if (name.length < 2) return Promise.resolve([])
  const params = new URLSearchParams({ name, count: String(count), language: language(), format: 'json' })
  // The request itself is shared between callers, so it is not tied to one caller's signal.
  const shared = searchCache.get(`${language()}:${count}:${name.toLowerCase()}`, async () =>
    parseGeocodingResponse(await fetchJson(`${SEARCH_URL}?${params}`, { retries: 1, timeoutMs: 8000 })),
  )
  return withSignal(shared, signal)
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeoLocation> {
  const fallback: GeoLocation = {
    id: locationId(latitude, longitude),
    name: `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`,
    latitude,
    longitude,
  }
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: language(),
    })
    const raw = await fetchJson(`${REVERSE_URL}?${params}`, { signal, retries: 0, timeoutMs: 6000 })
    if (typeof raw !== 'object' || raw === null) return fallback
    const r = raw as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
    const name = str(r.city) ?? str(r.locality)
    if (!name) return { ...fallback, country: str(r.countryName), countryCode: str(r.countryCode) }
    return {
      ...fallback,
      name,
      admin1: str(r.principalSubdivision),
      country: str(r.countryName),
      countryCode: str(r.countryCode),
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return fallback
  }
}

const FALLBACK_DEFAULT: GeoLocation = {
  id: locationId(51.50853, -0.12574),
  name: 'London',
  admin1: 'England',
  country: 'United Kingdom',
  countryCode: 'GB',
  latitude: 51.50853,
  longitude: -0.12574,
  timezone: 'Europe/London',
}

/**
 * A reasonable first-visit location without asking for any permission: the
 * city that names the browser's time zone (e.g. "Europe/Bucharest").
 */
export async function resolveDefaultLocation(signal?: AbortSignal): Promise<GeoLocation> {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const city = zone?.split('/').pop()?.replace(/_/g, ' ')
    if (!zone || !city || zone.startsWith('Etc/') || zone === 'UTC') return FALLBACK_DEFAULT
    const results = await searchLocations(city, signal, 10)
    return results.find((r) => r.timezone === zone) ?? FALLBACK_DEFAULT
  } catch (error) {
    if (signal?.aborted) throw error
    return FALLBACK_DEFAULT
  }
}

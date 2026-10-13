import type { GeoLocation } from '../types/weatherTypes'
import { formatCoordinates, locationId, parseGeocodingResponse } from '../utils/weatherTransformers'
import { RequestCache } from './cache'
import { fetchJson, withSignal } from './http'

/** https://open-meteo.com/en/docs/geocoding-api */
const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/**
 * Open-Meteo has no reverse geocoder, so naming a coordinate (device location,
 * map click, a shared link without a name) asks two free, key-less services in
 * turn: OpenStreetMap Nominatim, then BigDataCloud. Either can be unavailable
 * or blocked by a browser extension; if both fail the coordinates still work,
 * the place just has no name.
 */
const BIGDATACLOUD_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

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

type PlaceName = Pick<GeoLocation, 'admin1' | 'country' | 'countryCode'> & { name?: string }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
const firstText = (...values: unknown[]) => values.map(text).find((value) => value !== undefined)

async function viaBigDataCloud(latitude: number, longitude: number, signal?: AbortSignal): Promise<PlaceName | null> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: language() })
  const raw = await fetchJson(`${BIGDATACLOUD_URL}?${params}`, { signal, retries: 0, timeoutMs: 6000 })
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  return {
    name: firstText(r.city, r.locality),
    admin1: text(r.principalSubdivision),
    country: text(r.countryName),
    countryCode: text(r.countryCode),
  }
}

async function viaNominatim(latitude: number, longitude: number, signal?: AbortSignal): Promise<PlaceName | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '12',
    'accept-language': language(),
  })
  const raw = await fetchJson(`${NOMINATIM_URL}?${params}`, { signal, retries: 0, timeoutMs: 6000 })
  const address = (raw as { address?: Record<string, unknown> } | null)?.address
  if (typeof address !== 'object' || address === null) return null
  return {
    name: firstText(address.city, address.town, address.village, address.municipality, address.hamlet, address.suburb, address.county),
    admin1: firstText(address.state, address.region, address.county),
    country: text(address.country),
    countryCode: text(address.country_code)?.toUpperCase(),
  }
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeoLocation> {
  const unnamed: GeoLocation = {
    id: locationId(latitude, longitude),
    name: formatCoordinates(latitude, longitude),
    latitude,
    longitude,
  }
  let region: PlaceName | null = null
  for (const provider of [viaNominatim, viaBigDataCloud]) {
    try {
      const place = await provider(latitude, longitude, signal)
      if (place?.name) return { ...unnamed, ...place, name: place.name }
      region ??= place
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  // No locality known (open sea, wilderness): keep any region/country we did get.
  return { ...unnamed, admin1: region?.admin1, country: region?.country, countryCode: region?.countryCode }
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

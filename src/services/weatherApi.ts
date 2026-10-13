import type { GeoLocation, WeatherData } from '../types/weatherTypes'
import { parseForecastResponse } from '../utils/weatherTransformers'
import { RequestCache } from './cache'
import { fetchJson, withSignal } from './http'

/** https://open-meteo.com/en/docs */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Open-Meteo supports up to 16 days; skill drops off sharply past ~10. */
export const FORECAST_DAYS = 10

/** Open-Meteo's `current` block is interpolated to 15-minute steps. */
export const FORECAST_TTL_MS = 10 * 60_000

const CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'dew_point_2m',
  'is_day',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'precipitation_probability',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility',
  'uv_index',
]

const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'rain',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'surface_pressure',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
  'freezing_level_height',
]

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'sunrise',
  'sunset',
  'daylight_duration',
  'sunshine_duration',
  'uv_index_max',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
]

export function buildForecastUrl(latitude: number, longitude: number): string {
  // Canonical units are requested explicitly so presentation-layer conversion
  // is the only place a value ever changes unit.
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    forecast_days: String(FORECAST_DAYS),
    timezone: 'auto',
    timeformat: 'unixtime',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  })
  return `${FORECAST_URL}?${params}`
}

const cache = new RequestCache<WeatherData>({
  ttlMs: FORECAST_TTL_MS,
  persistPrefix: 'atmos:forecast',
  maxPersisted: 6,
})

/** Last stored forecast for a location, regardless of age. */
export function peekForecast(location: GeoLocation): WeatherData | null {
  return cache.peek(location.id)?.value ?? null
}

export function isForecastFresh(data: WeatherData): boolean {
  return Date.now() - data.fetchedAt < FORECAST_TTL_MS
}

export function fetchForecast(
  location: GeoLocation,
  options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<WeatherData> {
  // The shared in-flight request deliberately ignores the caller's signal:
  // another consumer (e.g. the comparison view) may be awaiting the same data.
  const shared = cache.get(
    location.id,
    async () => parseForecastResponse(await fetchJson(buildForecastUrl(location.latitude, location.longitude))),
    options.force,
  )
  return withSignal(shared, options.signal)
}

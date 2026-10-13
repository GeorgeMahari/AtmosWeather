import type { AirQualityData, GeoLocation } from '../types/weatherTypes'
import { parseAirQualityResponse } from '../utils/weatherTransformers'
import { RequestCache } from './cache'
import { fetchJson, withSignal } from './http'

/** https://open-meteo.com/en/docs/air-quality-api (CAMS model data, hourly). */
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const cache = new RequestCache<AirQualityData>({ ttlMs: 30 * 60_000 })

export function fetchAirQuality(location: GeoLocation, signal?: AbortSignal, force = false): Promise<AirQualityData> {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    current: [
      'european_aqi',
      'us_aqi',
      'pm10',
      'pm2_5',
      'carbon_monoxide',
      'nitrogen_dioxide',
      'sulphur_dioxide',
      'ozone',
      'alder_pollen',
      'birch_pollen',
      'grass_pollen',
      'mugwort_pollen',
      'olive_pollen',
      'ragweed_pollen',
    ].join(','),
    hourly: 'european_aqi,us_aqi,pm2_5,pm10',
    forecast_hours: '48',
    timezone: 'auto',
    timeformat: 'unixtime',
  })
  const shared = cache.get(
    location.id,
    async () => parseAirQualityResponse(await fetchJson(`${AIR_QUALITY_URL}?${params}`, { retries: 1 })),
    force,
  )
  return withSignal(shared, signal)
}

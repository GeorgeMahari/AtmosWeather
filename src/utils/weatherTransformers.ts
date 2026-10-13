import { ApiError } from '../services/http'
import type {
  AirQualityData,
  AirQualityHour,
  CurrentWeather,
  DailyPoint,
  GeoLocation,
  HourlyPoint,
  Maybe,
  WeatherData,
} from '../types/weatherTypes'

type Dict = Record<string, unknown>

const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null && !Array.isArray(value)

const num = (value: unknown): Maybe<number> => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const bool = (value: unknown): Maybe<boolean> => {
  const n = num(value)
  return n === null ? null : n === 1
}

/** Unix seconds → epoch ms. Zero/negative marks "no event" (e.g. polar night). */
const instant = (value: unknown): Maybe<number> => {
  const n = num(value)
  return n === null || n <= 0 ? null : n * 1000
}

function requireDict(value: unknown, what: string): Dict {
  if (!isDict(value)) throw new ApiError('malformed', `Missing ${what}`)
  return value
}

function requireTimes(block: Dict, what: string): number[] {
  const time = block.time
  if (!Array.isArray(time) || time.length === 0 || !time.every((t) => typeof t === 'number' && Number.isFinite(t))) {
    throw new ApiError('malformed', `Missing ${what} timestamps`)
  }
  return time as number[]
}

/** Reads one value of a column, tolerating missing or short columns. */
function column(block: Dict, key: string): (index: number) => unknown {
  const values = block[key]
  if (!Array.isArray(values)) return () => null
  return (index) => values[index]
}

export function locationId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`
}

export function parseForecastResponse(raw: unknown, fetchedAt = Date.now()): WeatherData {
  const root = requireDict(raw, 'forecast response')
  const latitude = num(root.latitude)
  const longitude = num(root.longitude)
  if (latitude === null || longitude === null || typeof root.timezone !== 'string') {
    throw new ApiError('malformed', 'Missing location metadata')
  }

  const cur = requireDict(root.current, 'current conditions')
  const currentTime = instant(cur.time)
  if (currentTime === null) throw new ApiError('malformed', 'Missing current timestamp')

  const current: CurrentWeather = {
    time: currentTime,
    intervalSeconds: num(cur.interval),
    temperature: num(cur.temperature_2m),
    apparentTemperature: num(cur.apparent_temperature),
    humidity: num(cur.relative_humidity_2m),
    dewPoint: num(cur.dew_point_2m),
    isDay: bool(cur.is_day),
    precipitation: num(cur.precipitation),
    rain: num(cur.rain),
    showers: num(cur.showers),
    snowfall: num(cur.snowfall),
    precipitationProbability: num(cur.precipitation_probability),
    weatherCode: num(cur.weather_code),
    cloudCover: num(cur.cloud_cover),
    pressureMsl: num(cur.pressure_msl),
    surfacePressure: num(cur.surface_pressure),
    windSpeed: num(cur.wind_speed_10m),
    windDirection: num(cur.wind_direction_10m),
    windGusts: num(cur.wind_gusts_10m),
    visibility: num(cur.visibility),
    uvIndex: num(cur.uv_index),
  }

  const h = requireDict(root.hourly, 'hourly forecast')
  const hc = (key: string) => column(h, key)
  const hCols = {
    temperature: hc('temperature_2m'),
    apparent: hc('apparent_temperature'),
    humidity: hc('relative_humidity_2m'),
    dewPoint: hc('dew_point_2m'),
    pop: hc('precipitation_probability'),
    precipitation: hc('precipitation'),
    rain: hc('rain'),
    snowfall: hc('snowfall'),
    code: hc('weather_code'),
    cloud: hc('cloud_cover'),
    pressureMsl: hc('pressure_msl'),
    surfacePressure: hc('surface_pressure'),
    visibility: hc('visibility'),
    windSpeed: hc('wind_speed_10m'),
    windDirection: hc('wind_direction_10m'),
    windGusts: hc('wind_gusts_10m'),
    uv: hc('uv_index'),
    isDay: hc('is_day'),
    freezing: hc('freezing_level_height'),
  }
  const hourly: HourlyPoint[] = requireTimes(h, 'hourly').map((t, i) => ({
    time: t * 1000,
    temperature: num(hCols.temperature(i)),
    apparentTemperature: num(hCols.apparent(i)),
    humidity: num(hCols.humidity(i)),
    dewPoint: num(hCols.dewPoint(i)),
    precipitationProbability: num(hCols.pop(i)),
    precipitation: num(hCols.precipitation(i)),
    rain: num(hCols.rain(i)),
    snowfall: num(hCols.snowfall(i)),
    weatherCode: num(hCols.code(i)),
    cloudCover: num(hCols.cloud(i)),
    pressureMsl: num(hCols.pressureMsl(i)),
    surfacePressure: num(hCols.surfacePressure(i)),
    visibility: num(hCols.visibility(i)),
    windSpeed: num(hCols.windSpeed(i)),
    windDirection: num(hCols.windDirection(i)),
    windGusts: num(hCols.windGusts(i)),
    uvIndex: num(hCols.uv(i)),
    isDay: bool(hCols.isDay(i)),
    freezingLevel: num(hCols.freezing(i)),
  }))

  const d = requireDict(root.daily, 'daily forecast')
  const dc = (key: string) => column(d, key)
  const dCols = {
    code: dc('weather_code'),
    tMax: dc('temperature_2m_max'),
    tMin: dc('temperature_2m_min'),
    aMax: dc('apparent_temperature_max'),
    aMin: dc('apparent_temperature_min'),
    sunrise: dc('sunrise'),
    sunset: dc('sunset'),
    daylight: dc('daylight_duration'),
    sunshine: dc('sunshine_duration'),
    uvMax: dc('uv_index_max'),
    precipSum: dc('precipitation_sum'),
    rainSum: dc('rain_sum'),
    snowSum: dc('snowfall_sum'),
    precipHours: dc('precipitation_hours'),
    popMax: dc('precipitation_probability_max'),
    windMax: dc('wind_speed_10m_max'),
    gustMax: dc('wind_gusts_10m_max'),
    windDir: dc('wind_direction_10m_dominant'),
  }
  const daily: DailyPoint[] = requireTimes(d, 'daily').map((t, i) => ({
    time: t * 1000,
    weatherCode: num(dCols.code(i)),
    temperatureMax: num(dCols.tMax(i)),
    temperatureMin: num(dCols.tMin(i)),
    apparentMax: num(dCols.aMax(i)),
    apparentMin: num(dCols.aMin(i)),
    sunrise: instant(dCols.sunrise(i)),
    sunset: instant(dCols.sunset(i)),
    daylightDuration: num(dCols.daylight(i)),
    sunshineDuration: num(dCols.sunshine(i)),
    uvIndexMax: num(dCols.uvMax(i)),
    precipitationSum: num(dCols.precipSum(i)),
    rainSum: num(dCols.rainSum(i)),
    snowfallSum: num(dCols.snowSum(i)),
    precipitationHours: num(dCols.precipHours(i)),
    precipitationProbabilityMax: num(dCols.popMax(i)),
    windSpeedMax: num(dCols.windMax(i)),
    windGustsMax: num(dCols.gustMax(i)),
    windDirectionDominant: num(dCols.windDir(i)),
  }))

  return {
    latitude,
    longitude,
    elevation: num(root.elevation),
    timezone: root.timezone,
    timezoneAbbreviation: typeof root.timezone_abbreviation === 'string' ? root.timezone_abbreviation : '',
    utcOffsetSeconds: num(root.utc_offset_seconds) ?? 0,
    current,
    hourly,
    daily,
    fetchedAt,
  }
}

const POLLEN: [key: string, label: string][] = [
  ['alder_pollen', 'Alder'],
  ['birch_pollen', 'Birch'],
  ['grass_pollen', 'Grass'],
  ['mugwort_pollen', 'Mugwort'],
  ['olive_pollen', 'Olive'],
  ['ragweed_pollen', 'Ragweed'],
]

export function parseAirQualityResponse(raw: unknown, fetchedAt = Date.now()): AirQualityData {
  const root = requireDict(raw, 'air-quality response')
  const cur = requireDict(root.current, 'current air quality')
  const time = instant(cur.time)
  if (time === null) throw new ApiError('malformed', 'Missing air-quality timestamp')

  let hourly: AirQualityHour[] = []
  if (isDict(root.hourly) && Array.isArray(root.hourly.time)) {
    const h = root.hourly
    const eu = column(h, 'european_aqi')
    const us = column(h, 'us_aqi')
    const pm25 = column(h, 'pm2_5')
    const pm10 = column(h, 'pm10')
    hourly = (h.time as unknown[]).flatMap((t, i) => {
      const at = instant(t)
      if (at === null) return []
      return [{ time: at, europeanAqi: num(eu(i)), usAqi: num(us(i)), pm25: num(pm25(i)), pm10: num(pm10(i)) }]
    })
  }

  return {
    time,
    timezone: typeof root.timezone === 'string' ? root.timezone : 'UTC',
    europeanAqi: num(cur.european_aqi),
    usAqi: num(cur.us_aqi),
    pm25: num(cur.pm2_5),
    pm10: num(cur.pm10),
    nitrogenDioxide: num(cur.nitrogen_dioxide),
    ozone: num(cur.ozone),
    sulphurDioxide: num(cur.sulphur_dioxide),
    carbonMonoxide: num(cur.carbon_monoxide),
    pollen: POLLEN.flatMap(([key, label]) => {
      const value = num(cur[key])
      return value === null ? [] : [{ key, label, value }]
    }),
    hourly,
    fetchedAt,
  }
}

export function parseGeocodingResponse(raw: unknown): GeoLocation[] {
  const root = requireDict(raw, 'geocoding response')
  // Open-Meteo omits `results` entirely when nothing matches.
  if (root.results === undefined) return []
  if (!Array.isArray(root.results)) throw new ApiError('malformed', 'Unexpected geocoding results')

  return root.results.flatMap((item): GeoLocation[] => {
    if (!isDict(item)) return []
    const latitude = num(item.latitude)
    const longitude = num(item.longitude)
    if (latitude === null || longitude === null || typeof item.name !== 'string') return []
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
    return [
      {
        id: locationId(latitude, longitude),
        name: item.name,
        admin1: str(item.admin1),
        country: str(item.country),
        countryCode: str(item.country_code),
        latitude,
        longitude,
        timezone: str(item.timezone),
        elevation: num(item.elevation) ?? undefined,
        population: num(item.population) ?? undefined,
      },
    ]
  })
}

/** "47.01°N, 28.86°E" */
export function formatCoordinates(latitude: number, longitude: number, digits = 2): string {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(digits)}°${value >= 0 ? positive : negative}`
  return `${part(latitude, 'N', 'S')}, ${part(longitude, 'E', 'W')}`
}

const COORDINATE_NAME = /^\s*-?\d{1,3}(\.\d+)?\s*°?\s*[NSEW]?\s*,\s*-?\d{1,3}(\.\d+)?\s*°?\s*[NSEW]?\s*$/i

/** True when a location's "name" is only a coordinate pair, i.e. no place name is known. */
export function isCoordinateName(name: string): boolean {
  return COORDINATE_NAME.test(name)
}

/** The place name to show; never raw coordinates (those are shown separately). */
export function locationTitle(location: GeoLocation): string {
  if (!isCoordinateName(location.name)) return location.name
  return location.admin1 ?? location.country ?? 'Unnamed place'
}

/** "Springfield, Illinois, United States" — skipping repeated parts. */
export function locationSubtitle(location: GeoLocation): string {
  const title = locationTitle(location)
  return [location.admin1, location.country].filter((part) => part && part !== title).join(', ')
}

// ---------------------------------------------------------------------------
// Selectors over normalised data
// ---------------------------------------------------------------------------

const HOUR = 3_600_000

/** Index of the hourly slot that contains `now` (or the nearest available). */
export function currentHourIndex(hourly: HourlyPoint[], now: number): number {
  if (hourly.length === 0) return -1
  for (let i = 0; i < hourly.length; i++) {
    if (hourly[i]!.time + HOUR > now) return i
  }
  return hourly.length - 1
}

export function upcomingHours(hourly: HourlyPoint[], now: number, count: number): HourlyPoint[] {
  const start = currentHourIndex(hourly, now)
  return start < 0 ? [] : hourly.slice(start, start + count)
}

/** The daily entry whose local day contains `now`; falls back to the first. */
export function todayIndex(daily: DailyPoint[], now: number): number {
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i]!.time <= now) return i
  }
  return daily.length ? 0 : -1
}

export function hoursOfDay(hourly: HourlyPoint[], daily: DailyPoint[], dayIndex: number): HourlyPoint[] {
  const start = daily[dayIndex]?.time
  if (start === undefined) return []
  const end = daily[dayIndex + 1]?.time ?? start + 24 * HOUR
  return hourly.filter((p) => p.time >= start && p.time < end)
}

/**
 * Some values are only meaningful hourly. When the provider leaves a "current"
 * field empty we fall back to the forecast hour that contains the present.
 */
export function withHourlyFallback(data: WeatherData, now: number): CurrentWeather {
  const hour = data.hourly[currentHourIndex(data.hourly, now)]
  if (!hour) return data.current
  const c = data.current
  return {
    ...c,
    dewPoint: c.dewPoint ?? hour.dewPoint,
    visibility: c.visibility ?? hour.visibility,
    uvIndex: c.uvIndex ?? hour.uvIndex,
    precipitationProbability: c.precipitationProbability ?? hour.precipitationProbability,
  }
}

/** Change in sea-level pressure over the previous three hours, if known. */
export function pressureTendency(data: WeatherData, now: number): Maybe<number> {
  const index = currentHourIndex(data.hourly, now)
  const present = data.current.pressureMsl ?? data.hourly[index]?.pressureMsl ?? null
  const past = data.hourly[index - 3]?.pressureMsl ?? null
  return present === null || past === null ? null : present - past
}

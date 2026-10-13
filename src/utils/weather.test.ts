import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/http'
import { buildForecastUrl } from '../services/weatherApi'
import { formatHour, formatTime, localDayKey, localHour } from './dateFormatting'
import { solarPosition } from './solar'
import { locationFromUrl, locationToSearch } from './storage'
import {
  IMPERIAL_UNITS,
  METRIC_UNITS,
  cardinalDirection,
  celsiusToFahrenheit,
  convertDistance,
  convertPrecipitation,
  convertPressure,
  convertTemperatureDelta,
  convertWind,
  createFormatters,
  formatDuration,
} from './unitConversions'
import { EUROPEAN_AQI_BANDS, US_AQI_BANDS, aqiBand, beaufort, getCondition, getIconKey, selectScene, uvCategory } from './weatherConditions'
import {
  currentHourIndex,
  parseAirQualityResponse,
  parseForecastResponse,
  parseGeocodingResponse,
  pressureTendency,
  todayIndex,
  upcomingHours,
  withHourlyFallback,
} from './weatherTransformers'

// A trimmed but structurally real Open-Meteo response (Bucharest, UTC+3).
const T0 = 1791838800 // local midnight
const validForecast = () => ({
  latitude: 44.42,
  longitude: 26.07,
  utc_offset_seconds: 10800,
  timezone: 'Europe/Bucharest',
  timezone_abbreviation: 'GMT+3',
  elevation: 83,
  current: {
    time: T0 + 12 * 3600 + 900,
    interval: 900,
    temperature_2m: 13.6,
    relative_humidity_2m: 78,
    apparent_temperature: 13.0,
    is_day: 1,
    precipitation: 0,
    weather_code: 3,
    cloud_cover: 100,
    pressure_msl: 1020.3,
    surface_pressure: 1010.3,
    wind_speed_10m: 4.0,
    wind_direction_10m: 5,
    wind_gusts_10m: 11.9,
    // dew_point_2m, visibility, uv_index deliberately absent
  },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => T0 + i * 3600),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 10 + (i % 24) / 4),
    dew_point_2m: Array.from({ length: 48 }, () => 9.8),
    pressure_msl: Array.from({ length: 48 }, (_, i) => 1015 + i * 0.5),
    uv_index: Array.from({ length: 48 }, () => null),
    precipitation_probability: Array.from({ length: 48 }, () => 41),
    visibility: Array.from({ length: 48 }, () => 32000),
  },
  daily: {
    time: [T0, T0 + 86400],
    weather_code: [61, 3],
    temperature_2m_max: [14.4, 15.5],
    temperature_2m_min: [9.1, 8.2],
    sunrise: [T0 + 26880, T0 + 86400 + 26956],
    sunset: [T0 + 66921, 0],
  },
})

describe('unit conversions', () => {
  it('converts temperature with the documented formula', () => {
    expect(celsiusToFahrenheit(0)).toBe(32)
    expect(celsiusToFahrenheit(100)).toBe(212)
    expect(celsiusToFahrenheit(-40)).toBe(-40)
    expect(celsiusToFahrenheit(21.5)).toBeCloseTo(70.7, 5)
  })

  it('converts differences without the 32° offset', () => {
    expect(convertTemperatureDelta(5, 'f')).toBe(9)
    expect(convertTemperatureDelta(5, 'c')).toBe(5)
  })

  it('converts wind, precipitation, pressure and distance', () => {
    expect(convertWind(36, 'ms')).toBeCloseTo(10, 6)
    expect(convertWind(100, 'mph')).toBeCloseTo(62.137, 3)
    expect(convertWind(18.52, 'kn')).toBeCloseTo(10, 6)
    expect(convertWind(42, 'kmh')).toBe(42)
    expect(convertPrecipitation(25.4, 'in')).toBeCloseTo(1, 6)
    expect(convertPressure(1013.25, 'inhg')).toBeCloseTo(29.92, 2)
    expect(convertPressure(1013.25, 'hpa')).toBe(1013.25)
    expect(convertDistance(1609.344, 'mi')).toBeCloseTo(1, 6)
    expect(convertDistance(2500, 'km')).toBe(2.5)
  })

  it('formats through the selected units exactly once', () => {
    const metric = createFormatters(METRIC_UNITS)
    const imperial = createFormatters(IMPERIAL_UNITS)
    expect(metric.temp(20).number).toBe(20)
    expect(imperial.temp(20).number).toBe(68)
    expect(imperial.tempFull(20).unit).toBe('°F')
    expect(imperial.wind(16.09344).number).toBeCloseTo(10, 6)
    expect(imperial.snow(2.54).number).toBeCloseTo(1, 6)
    expect(imperial.altitude(304.8).number).toBeCloseTo(1000, 6)
  })

  it('renders missing values as unavailable, never as zero', () => {
    const fmt = createFormatters(METRIC_UNITS)
    expect(fmt.temp(null).text).toBe('—')
    expect(fmt.temp(null).number).toBeNull()
    expect(fmt.precip(null).text).toBe('—')
    expect(fmt.temp(0).number).toBe(0)
    expect(fmt.temp(0).text).not.toBe('—')
    expect(fmt.temp(-0.2).value).not.toMatch(/^[-−]0$/)
  })

  it('maps bearings to cardinal labels', () => {
    expect(cardinalDirection(0)).toBe('N')
    expect(cardinalDirection(359)).toBe('N')
    expect(cardinalDirection(90)).toBe('E')
    expect(cardinalDirection(202.5)).toBe('SSW')
    expect(cardinalDirection(-90)).toBe('W')
    expect(cardinalDirection(null)).toBe('—')
  })

  it('formats durations', () => {
    expect(formatDuration(40054.86)).toBe('11h 08m')
    expect(formatDuration(540)).toBe('9m')
    expect(formatDuration(null)).toBe('—')
  })
})

describe('forecast response parsing', () => {
  it('normalises a valid response', () => {
    const data = parseForecastResponse(validForecast(), 123)
    expect(data.timezone).toBe('Europe/Bucharest')
    expect(data.fetchedAt).toBe(123)
    expect(data.current.temperature).toBe(13.6)
    expect(data.current.isDay).toBe(true)
    expect(data.current.time).toBe((T0 + 12 * 3600 + 900) * 1000)
    expect(data.hourly).toHaveLength(48)
    expect(data.hourly[0]!.time).toBe(T0 * 1000)
    expect(data.daily).toHaveLength(2)
    expect(data.daily[0]!.temperatureMax).toBe(14.4)
  })

  it('keeps missing variables as null instead of inventing values', () => {
    const data = parseForecastResponse(validForecast())
    expect(data.current.dewPoint).toBeNull()
    expect(data.current.uvIndex).toBeNull()
    expect(data.hourly[0]!.windSpeed).toBeNull()
    expect(data.hourly[0]!.uvIndex).toBeNull()
    expect(data.daily[0]!.precipitationSum).toBeNull()
    // A zero timestamp (polar day/night) is "no event", not 1 Jan 1970.
    expect(data.daily[1]!.sunset).toBeNull()
  })

  it('rejects malformed responses', () => {
    const cases: unknown[] = [
      null,
      'oops',
      [],
      {},
      { error: true, reason: 'bad' },
      { ...validForecast(), timezone: undefined },
      { ...validForecast(), current: undefined },
      { ...validForecast(), current: { temperature_2m: 3 } },
      { ...validForecast(), hourly: { time: [] } },
      { ...validForecast(), hourly: { time: ['2026-10-13T00:00'] } },
      { ...validForecast(), daily: null },
    ]
    for (const raw of cases) {
      expect(() => parseForecastResponse(raw)).toThrowError(ApiError)
    }
  })

  it('ignores non-numeric junk in individual fields', () => {
    const raw = validForecast()
    ;(raw.current as Record<string, unknown>).temperature_2m = 'warm'
    ;(raw.hourly as Record<string, unknown>).temperature_2m = [NaN, '7', 5]
    const data = parseForecastResponse(raw)
    expect(data.current.temperature).toBeNull()
    expect(data.hourly.slice(0, 4).map((h) => h.temperature)).toEqual([null, null, 5, null])
  })

  it('requests canonical metric units and the location time zone', () => {
    const url = new URL(buildForecastUrl(44.4268, 26.1025))
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('timezone')).toBe('auto')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    expect(url.searchParams.get('temperature_unit')).toBe('celsius')
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh')
    expect(url.searchParams.get('current')).toContain('weather_code')
    expect(url.searchParams.get('daily')).toContain('sunrise')
  })
})

describe('forecast selectors', () => {
  const data = parseForecastResponse(validForecast())
  const noon = (T0 + 12 * 3600 + 1200) * 1000

  it('finds the hour containing "now" and the following hours', () => {
    expect(currentHourIndex(data.hourly, noon)).toBe(12)
    expect(upcomingHours(data.hourly, noon, 24)).toHaveLength(24)
    expect(upcomingHours(data.hourly, noon, 24)[0]!.time).toBe((T0 + 12 * 3600) * 1000)
    // Past the end of the data: clamp rather than run off the array.
    expect(currentHourIndex(data.hourly, (T0 + 500 * 3600) * 1000)).toBe(47)
    expect(upcomingHours([], noon, 24)).toEqual([])
  })

  it('finds today in the location calendar', () => {
    expect(todayIndex(data.daily, noon)).toBe(0)
    expect(todayIndex(data.daily, (T0 + 86400 + 60) * 1000)).toBe(1)
  })

  it('fills hourly-only fields from the current hour', () => {
    const current = withHourlyFallback(data, noon)
    expect(current.dewPoint).toBe(9.8)
    expect(current.visibility).toBe(32000)
    expect(current.uvIndex).toBeNull()
    expect(current.temperature).toBe(13.6)
  })

  it('derives the 3-hour pressure tendency', () => {
    // current 1020.3 vs hourly[9] = 1015 + 4.5
    expect(pressureTendency(data, noon)).toBeCloseTo(0.8, 5)
    expect(pressureTendency(data, (T0 + 600) * 1000)).toBeNull()
  })
})

describe('other API parsers', () => {
  it('parses geocoding results and the empty case', () => {
    expect(parseGeocodingResponse({ generationtime_ms: 1 })).toEqual([])
    const results = parseGeocodingResponse({
      results: [
        { id: 1, name: 'Springfield', latitude: 37.2, longitude: -93.3, country: 'United States', country_code: 'US', admin1: 'Missouri', timezone: 'America/Chicago' },
        { id: 2, name: 'Broken' },
        'junk',
      ],
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ name: 'Springfield', admin1: 'Missouri', countryCode: 'US', id: '37.200,-93.300' })
    expect(() => parseGeocodingResponse({ results: 'no' })).toThrowError(ApiError)
    expect(() => parseGeocodingResponse(null)).toThrowError(ApiError)
  })

  it('parses air quality and keeps absent indices null', () => {
    const aq = parseAirQualityResponse({
      timezone: 'Europe/Bucharest',
      current: { time: T0, european_aqi: 24, pm2_5: 7.2, grass_pollen: 0.2, birch_pollen: null },
      hourly: { time: [T0, T0 + 3600], european_aqi: [24, 23] },
    })
    expect(aq.europeanAqi).toBe(24)
    expect(aq.usAqi).toBeNull()
    expect(aq.pollen).toEqual([{ key: 'grass_pollen', label: 'Grass', value: 0.2 }])
    expect(aq.hourly).toHaveLength(2)
    expect(aq.hourly[1]!.usAqi).toBeNull()
    expect(() => parseAirQualityResponse({ current: {} })).toThrowError(ApiError)
  })
})

describe('weather codes', () => {
  it('distinguishes the precipitation families', () => {
    expect(getCondition(53).category).toBe('drizzle')
    expect(getCondition(63).category).toBe('rain')
    expect(getCondition(66).category).toBe('freezing-rain')
    expect(getCondition(73).category).toBe('snow')
    expect(getCondition(45).category).toBe('fog')
    expect(getCondition(95).category).toBe('thunderstorm')
    expect(getCondition(66).frozen).toBe(true)
    expect(getCondition(63).frozen).toBe(false)
    expect(getCondition(45).wet).toBe(false)
  })

  it('handles unknown and missing codes safely', () => {
    expect(getCondition(null).category).toBe('unknown')
    expect(getCondition(1234).category).toBe('unknown')
    expect(getIconKey(1234, true)).toBe('unknown')
  })

  it('picks day and night icons', () => {
    expect(getIconKey(0, true)).toBe('sun')
    expect(getIconKey(0, false)).toBe('moon')
    expect(getIconKey(2, false)).toBe('moon-cloud')
    expect(getIconKey(65, true)).toBe('rain-heavy')
  })

  it('selects background scenes from conditions and solar time', () => {
    const base = { now: 1_000_000_000, sunrise: 1_000_000_000 - 6 * 3_600_000, sunset: 1_000_000_000 + 6 * 3_600_000, temperature: 20 }
    const scene = (weatherCode: number | null, isDay: boolean | null, extra = {}) =>
      selectScene({ ...base, weatherCode, isDay, ...extra }).key

    expect(scene(0, true)).toBe('clear-day')
    expect(scene(0, false)).toBe('clear-night')
    expect(scene(2, true)).toBe('partly-day')
    expect(scene(2, false)).toBe('partly-night')
    expect(scene(3, true)).toBe('overcast-day')
    expect(scene(3, false)).toBe('overcast-night')
    expect(scene(61, true)).toBe('rain')
    expect(scene(51, true)).toBe('rain')
    expect(scene(65, true)).toBe('heavy-rain')
    expect(scene(95, false)).toBe('storm')
    expect(scene(73, true)).toBe('snow')
    expect(scene(48, true)).toBe('fog')
    expect(scene(null, true)).toBe('neutral')
    expect(scene(0, true, { temperature: 38 })).toBe('heat')
    expect(scene(0, false, { temperature: 38 })).toBe('clear-night')
    expect(scene(1, true, { sunset: base.now + 10 * 60_000 })).toBe('sunset')
    expect(scene(0, true, { sunrise: base.now - 20 * 60_000 })).toBe('sunrise')
    // Rain wins over twilight colours.
    expect(scene(63, true, { sunset: base.now + 10 * 60_000 })).toBe('rain')
    expect(selectScene({ ...base, weatherCode: 75, isDay: true }).effects.snow).toBe(2)
  })

  it('labels UV, wind and AQI on their own scales', () => {
    expect(uvCategory(2.9)).toBe('Low')
    expect(uvCategory(6)).toBe('High')
    expect(uvCategory(11)).toBe('Extreme')
    expect(beaufort(0)?.force).toBe(0)
    expect(beaufort(30)?.label).toBe('Fresh breeze')
    expect(beaufort(130)?.force).toBe(12)
    expect(beaufort(null)).toBeNull()
    expect(aqiBand(24, EUROPEAN_AQI_BANDS)?.label).toBe('Fair')
    expect(aqiBand(24, US_AQI_BANDS)?.label).toBe('Good')
    expect(aqiBand(null, US_AQI_BANDS)).toBeNull()
  })
})

describe('time zones and dates', () => {
  const instant = Date.UTC(2026, 9, 13, 21, 30) // 21:30 UTC

  it('renders instants in the location zone, not the machine zone', () => {
    expect(localHour(instant, 'Europe/Bucharest')).toBe(0.5)
    expect(localHour(instant, 'America/New_York')).toBe(17.5)
    expect(localHour(instant, 'Asia/Kolkata')).toBe(3)
    expect(localDayKey(instant, 'Europe/Bucharest')).not.toBe(localDayKey(instant, 'America/New_York'))
  })

  it('honours the 12/24-hour preference', () => {
    expect(formatTime(instant, 'America/New_York', '24')).toMatch(/17[:.]30/)
    expect(formatTime(instant, 'America/New_York', '12')).toMatch(/5[:.]30/)
    expect(formatHour(instant, 'America/New_York', '24')).toMatch(/17[:.]30/)
  })

  it('survives an unknown time zone identifier', () => {
    expect(() => formatTime(instant, 'Mars/Olympus_Mons', '24')).not.toThrow()
  })
})

describe('solar position', () => {
  it('puts the sun overhead at the equator near the March equinox', () => {
    const { elevation } = solarPosition(Date.UTC(2026, 2, 20, 12, 7), 0, 0)
    expect(elevation).toBeGreaterThan(87)
  })

  it('puts the sun below the horizon at local midnight', () => {
    expect(solarPosition(Date.UTC(2026, 9, 13, 21, 0), 44.43, 26.1).elevation).toBeLessThan(-30)
  })

  it('matches a known mid-latitude noon elevation', () => {
    // Bucharest, 13 Oct, solar noon ≈ 10:02 UTC: 90 − 44.43 − 7.9 ≈ 37.7°
    const { elevation, azimuth } = solarPosition(Date.UTC(2026, 9, 13, 10, 2), 44.43, 26.1)
    expect(elevation).toBeGreaterThan(36.5)
    expect(elevation).toBeLessThan(38.5)
    expect(azimuth).toBeGreaterThan(175)
    expect(azimuth).toBeLessThan(185)
  })
})

describe('shareable URLs', () => {
  it('round-trips a location through the query string', () => {
    const search = locationToSearch({ id: 'x', name: 'São Paulo', admin1: 'São Paulo', country: 'Brazil', latitude: -23.5475, longitude: -46.63611 })
    const parsed = locationFromUrl(search)
    expect(parsed).toMatchObject({ name: 'São Paulo', country: 'Brazil', latitude: -23.5475, longitude: -46.6361 })
  })

  it('rejects invalid coordinates', () => {
    expect(locationFromUrl('')).toBeNull()
    expect(locationFromUrl('?lat=abc&lon=1')).toBeNull()
    expect(locationFromUrl('?lat=120&lon=10')).toBeNull()
    expect(locationFromUrl('?lat=&lon=')).toBeNull()
    expect(locationFromUrl('?lat=10&lon=20')?.name).toBe('10.00, 20.00')
  })
})

import type {
  DistanceUnit,
  Maybe,
  PrecipitationUnit,
  PressureUnit,
  TemperatureUnit,
  UnitSettings,
  WindUnit,
} from '../types/weatherTypes'

/**
 * Every unit conversion in the app lives here. Data is stored in canonical
 * metric units and converted exactly once, at the moment of presentation.
 */

export const UNAVAILABLE = '—'

export const METRIC_UNITS: UnitSettings = {
  temperature: 'c',
  wind: 'kmh',
  precipitation: 'mm',
  pressure: 'hpa',
  distance: 'km',
}

export const IMPERIAL_UNITS: UnitSettings = {
  temperature: 'f',
  wind: 'mph',
  precipitation: 'in',
  pressure: 'inhg',
  distance: 'mi',
}

export const celsiusToFahrenheit = (c: number) => (c * 9) / 5 + 32

export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === 'f' ? celsiusToFahrenheit(celsius) : celsius
}

/** A temperature *difference* (no +32 offset). */
export function convertTemperatureDelta(celsius: number, unit: TemperatureUnit): number {
  return unit === 'f' ? (celsius * 9) / 5 : celsius
}

export function convertWind(kmh: number, unit: WindUnit): number {
  switch (unit) {
    case 'ms':
      return kmh / 3.6
    case 'mph':
      return kmh / 1.609344
    case 'kn':
      return kmh / 1.852
    default:
      return kmh
  }
}

export function convertPrecipitation(mm: number, unit: PrecipitationUnit): number {
  return unit === 'in' ? mm / 25.4 : mm
}

export function convertPressure(hpa: number, unit: PressureUnit): number {
  return unit === 'inhg' ? hpa * 0.0295299830714 : hpa
}

/** Metres → km or miles. */
export function convertDistance(metres: number, unit: DistanceUnit): number {
  return unit === 'mi' ? metres / 1609.344 : metres / 1000
}

/** Metres → metres or feet (altitudes follow the distance preference). */
export function convertAltitude(metres: number, unit: DistanceUnit): number {
  return unit === 'mi' ? metres / 0.3048 : metres
}

export const UNIT_LABELS = {
  temperature: { c: '°C', f: '°F' },
  wind: { kmh: 'km/h', ms: 'm/s', mph: 'mph', kn: 'kn' },
  precipitation: { mm: 'mm', in: 'in' },
  pressure: { hpa: 'hPa', inhg: 'inHg' },
  distance: { km: 'km', mi: 'mi' },
} as const

const locale = () => (typeof navigator !== 'undefined' ? navigator.language : undefined)

const formatters = new Map<string, Intl.NumberFormat>()
export function formatNumber(value: number, maxDigits = 0, minDigits = 0): string {
  const key = `${maxDigits}:${minDigits}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale(), { maximumFractionDigits: maxDigits, minimumFractionDigits: minDigits })
    formatters.set(key, f)
  }
  // Avoid "-0".
  const rounded = Number(value.toFixed(maxDigits))
  return f.format(rounded === 0 ? 0 : rounded)
}

export interface Formatted {
  /** Locale-formatted number, or an em dash when unavailable. */
  value: string
  unit: string
  /** value + unit, ready for inline text. */
  text: string
  /** Converted number for charts and gauges. */
  number: Maybe<number>
}

function build(number: Maybe<number>, digits: number, unit: string, tight = false, minDigits = 0): Formatted {
  if (number === null || !Number.isFinite(number)) {
    return { value: UNAVAILABLE, unit, text: UNAVAILABLE, number: null }
  }
  const value = formatNumber(number, digits, minDigits)
  return { value, unit, text: tight ? `${value}${unit}` : `${value} ${unit}`, number }
}

const map = (value: Maybe<number>, fn: (v: number) => number): Maybe<number> => (value === null ? null : fn(value))

/** Formatting bound to the user's unit preferences. */
export function createFormatters(units: UnitSettings) {
  return {
    units,
    /** "18°" — the unit letter is implied by the global selector. */
    temp: (c: Maybe<number>, digits = 0) =>
      build(map(c, (v) => convertTemperature(v, units.temperature)), digits, '°', true),
    tempFull: (c: Maybe<number>, digits = 0) =>
      build(map(c, (v) => convertTemperature(v, units.temperature)), digits, UNIT_LABELS.temperature[units.temperature], true),
    wind: (kmh: Maybe<number>) =>
      build(map(kmh, (v) => convertWind(v, units.wind)), units.wind === 'ms' ? 1 : 0, UNIT_LABELS.wind[units.wind]),
    precip: (mm: Maybe<number>) =>
      build(
        map(mm, (v) => convertPrecipitation(v, units.precipitation)),
        units.precipitation === 'in' ? 2 : 1,
        UNIT_LABELS.precipitation[units.precipitation],
      ),
    /** Open-Meteo reports snowfall depth in centimetres. */
    snow: (cm: Maybe<number>) =>
      units.precipitation === 'in' ? build(map(cm, (v) => v / 2.54), 1, 'in') : build(cm, 1, 'cm'),
    pressure: (hpa: Maybe<number>) =>
      units.pressure === 'inhg'
        ? build(map(hpa, (v) => convertPressure(v, 'inhg')), 2, 'inHg', false, 2)
        : build(hpa, 0, 'hPa'),
    distance: (m: Maybe<number>) => {
      const converted = map(m, (v) => convertDistance(v, units.distance))
      return build(converted, converted !== null && converted < 10 ? 1 : 0, UNIT_LABELS.distance[units.distance])
    },
    altitude: (m: Maybe<number>) =>
      build(map(m, (v) => convertAltitude(v, units.distance)), 0, units.distance === 'mi' ? 'ft' : 'm'),
    percent: (v: Maybe<number>) => build(v, 0, '%', true),
    plain: (v: Maybe<number>, digits = 0) => build(v, digits, '', true),
  }
}

export type Formatters = ReturnType<typeof createFormatters>

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const CARDINAL_NAMES: Record<string, string> = {
  N: 'north',
  NNE: 'north-northeast',
  NE: 'northeast',
  ENE: 'east-northeast',
  E: 'east',
  ESE: 'east-southeast',
  SE: 'southeast',
  SSE: 'south-southeast',
  S: 'south',
  SSW: 'south-southwest',
  SW: 'southwest',
  WSW: 'west-southwest',
  W: 'west',
  WNW: 'west-northwest',
  NW: 'northwest',
  NNW: 'north-northwest',
}

/** Meteorological direction (where the wind blows *from*) → 16-point label. */
export function cardinalDirection(degrees: Maybe<number>): string {
  if (degrees === null) return UNAVAILABLE
  const normalised = ((degrees % 360) + 360) % 360
  return CARDINALS[Math.round(normalised / 22.5) % 16]!
}

export function cardinalName(degrees: Maybe<number>): string {
  const short = cardinalDirection(degrees)
  return CARDINAL_NAMES[short] ?? short
}

/** "12h 34m" from seconds. */
export function formatDuration(seconds: Maybe<number>): string {
  if (seconds === null || seconds < 0) return UNAVAILABLE
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

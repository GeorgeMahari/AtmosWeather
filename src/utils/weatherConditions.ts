import type { Maybe } from '../types/weatherTypes'

/**
 * Single source of truth for interpreting WMO weather codes as returned by
 * Open-Meteo (`weather_code`), per the table in https://open-meteo.com/en/docs.
 */

export type WeatherCategory =
  | 'clear'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-drizzle'
  | 'rain'
  | 'freezing-rain'
  | 'rain-showers'
  | 'snow'
  | 'snow-grains'
  | 'snow-showers'
  | 'thunderstorm'
  | 'thunderstorm-hail'
  | 'unknown'

export type Intensity = 'light' | 'moderate' | 'heavy' | null

export type IconKey =
  | 'sun'
  | 'moon'
  | 'sun-cloud'
  | 'moon-cloud'
  | 'cloud'
  | 'clouds'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'rain-heavy'
  | 'sleet'
  | 'snow'
  | 'snow-heavy'
  | 'thunder'
  | 'hail'
  | 'unknown'

export interface Condition {
  code: Maybe<number>
  category: WeatherCategory
  intensity: Intensity
  description: string
  /** Lower-case noun phrase usable mid-sentence ("light rain"). */
  phrase: string
  /** True for anything that falls from the sky. */
  wet: boolean
  frozen: boolean
}

type Row = [category: WeatherCategory, intensity: Intensity, description: string, phrase: string]

const TABLE: Record<number, Row> = {
  0: ['clear', null, 'Clear sky', 'clear skies'],
  1: ['mostly-clear', null, 'Mainly clear', 'mostly clear skies'],
  2: ['partly-cloudy', null, 'Partly cloudy', 'partly cloudy skies'],
  3: ['overcast', null, 'Overcast', 'overcast skies'],
  45: ['fog', null, 'Fog', 'fog'],
  48: ['fog', null, 'Depositing rime fog', 'freezing fog'],
  51: ['drizzle', 'light', 'Light drizzle', 'light drizzle'],
  53: ['drizzle', 'moderate', 'Drizzle', 'drizzle'],
  55: ['drizzle', 'heavy', 'Dense drizzle', 'dense drizzle'],
  56: ['freezing-drizzle', 'light', 'Light freezing drizzle', 'light freezing drizzle'],
  57: ['freezing-drizzle', 'heavy', 'Dense freezing drizzle', 'dense freezing drizzle'],
  61: ['rain', 'light', 'Light rain', 'light rain'],
  63: ['rain', 'moderate', 'Rain', 'rain'],
  65: ['rain', 'heavy', 'Heavy rain', 'heavy rain'],
  66: ['freezing-rain', 'light', 'Light freezing rain', 'light freezing rain'],
  67: ['freezing-rain', 'heavy', 'Heavy freezing rain', 'heavy freezing rain'],
  71: ['snow', 'light', 'Light snow', 'light snow'],
  73: ['snow', 'moderate', 'Snow', 'snow'],
  75: ['snow', 'heavy', 'Heavy snow', 'heavy snow'],
  77: ['snow-grains', null, 'Snow grains', 'snow grains'],
  80: ['rain-showers', 'light', 'Light rain showers', 'light showers'],
  81: ['rain-showers', 'moderate', 'Rain showers', 'showers'],
  82: ['rain-showers', 'heavy', 'Violent rain showers', 'violent showers'],
  85: ['snow-showers', 'light', 'Light snow showers', 'light snow showers'],
  86: ['snow-showers', 'heavy', 'Heavy snow showers', 'heavy snow showers'],
  95: ['thunderstorm', 'moderate', 'Thunderstorm', 'thunderstorms'],
  96: ['thunderstorm-hail', 'light', 'Thunderstorm with light hail', 'thunderstorms with hail'],
  99: ['thunderstorm-hail', 'heavy', 'Thunderstorm with heavy hail', 'thunderstorms with heavy hail'],
}

const WET: ReadonlySet<WeatherCategory> = new Set([
  'drizzle',
  'freezing-drizzle',
  'rain',
  'freezing-rain',
  'rain-showers',
  'snow',
  'snow-grains',
  'snow-showers',
  'thunderstorm',
  'thunderstorm-hail',
])

const FROZEN: ReadonlySet<WeatherCategory> = new Set([
  'freezing-drizzle',
  'freezing-rain',
  'snow',
  'snow-grains',
  'snow-showers',
])

const UNKNOWN: Condition = {
  code: null,
  category: 'unknown',
  intensity: null,
  description: 'Conditions unavailable',
  phrase: 'unknown conditions',
  wet: false,
  frozen: false,
}

export function getCondition(code: Maybe<number>): Condition {
  const row = code === null ? undefined : TABLE[code]
  if (!row) return { ...UNKNOWN, code }
  const [category, intensity, description, phrase] = row
  return { code, category, intensity, description, phrase, wet: WET.has(category), frozen: FROZEN.has(category) }
}

export function getIconKey(code: Maybe<number>, isDay: boolean): IconKey {
  const { category, intensity } = getCondition(code)
  switch (category) {
    case 'clear':
    case 'mostly-clear':
      return isDay ? 'sun' : 'moon'
    case 'partly-cloudy':
      return isDay ? 'sun-cloud' : 'moon-cloud'
    case 'overcast':
      return 'clouds'
    case 'fog':
      return 'fog'
    case 'drizzle':
      return 'drizzle'
    case 'freezing-drizzle':
    case 'freezing-rain':
      return 'sleet'
    case 'rain':
    case 'rain-showers':
      return intensity === 'heavy' ? 'rain-heavy' : 'rain'
    case 'snow':
    case 'snow-showers':
      return intensity === 'heavy' ? 'snow-heavy' : 'snow'
    case 'snow-grains':
      return 'snow'
    case 'thunderstorm':
      return 'thunder'
    case 'thunderstorm-hail':
      return 'hail'
    default:
      return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Background scenes
// ---------------------------------------------------------------------------

export type SceneKey =
  | 'clear-day'
  | 'clear-night'
  | 'partly-day'
  | 'partly-night'
  | 'overcast-day'
  | 'overcast-night'
  | 'rain'
  | 'heavy-rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'sunrise'
  | 'sunset'
  | 'heat'
  | 'neutral'

export interface Scene {
  key: SceneKey
  /** Decorative layers the background should render. */
  effects: {
    stars: boolean
    sun: boolean
    moon: boolean
    clouds: 0 | 1 | 2 | 3
    rain: 0 | 1 | 2
    snow: 0 | 1 | 2
    fog: boolean
    lightning: boolean
    haze: boolean
  }
  label: string
}

const fx = (overrides: Partial<Scene['effects']>): Scene['effects'] => ({
  stars: false,
  sun: false,
  moon: false,
  clouds: 0,
  rain: 0,
  snow: 0,
  fog: false,
  lightning: false,
  haze: false,
  ...overrides,
})

export const SCENES: Record<SceneKey, Scene> = {
  'clear-day': { key: 'clear-day', label: 'Clear day', effects: fx({ sun: true }) },
  'clear-night': { key: 'clear-night', label: 'Clear night', effects: fx({ stars: true, moon: true }) },
  'partly-day': { key: 'partly-day', label: 'Partly cloudy day', effects: fx({ sun: true, clouds: 2 }) },
  'partly-night': { key: 'partly-night', label: 'Partly cloudy night', effects: fx({ stars: true, moon: true, clouds: 2 }) },
  'overcast-day': { key: 'overcast-day', label: 'Overcast', effects: fx({ clouds: 3 }) },
  'overcast-night': { key: 'overcast-night', label: 'Overcast night', effects: fx({ clouds: 3 }) },
  rain: { key: 'rain', label: 'Rain', effects: fx({ clouds: 3, rain: 1 }) },
  'heavy-rain': { key: 'heavy-rain', label: 'Heavy rain', effects: fx({ clouds: 3, rain: 2 }) },
  storm: { key: 'storm', label: 'Thunderstorm', effects: fx({ clouds: 3, rain: 2, lightning: true }) },
  snow: { key: 'snow', label: 'Snow', effects: fx({ clouds: 2, snow: 1 }) },
  fog: { key: 'fog', label: 'Fog', effects: fx({ fog: true, clouds: 1 }) },
  sunrise: { key: 'sunrise', label: 'Sunrise', effects: fx({ sun: true, clouds: 1 }) },
  sunset: { key: 'sunset', label: 'Sunset', effects: fx({ sun: true, clouds: 1 }) },
  heat: { key: 'heat', label: 'Extreme heat', effects: fx({ sun: true, haze: true }) },
  neutral: { key: 'neutral', label: 'Neutral', effects: fx({}) },
}

/** Minutes either side of sunrise/sunset that get the twilight treatment. */
const TWILIGHT_WINDOW_MS = 40 * 60_000
/** Air temperature (°C) at which a clear daytime sky switches to the heat scene. */
export const EXTREME_HEAT_C = 35

export interface SceneInput {
  weatherCode: Maybe<number>
  isDay: Maybe<boolean>
  temperature: Maybe<number>
  now: number
  sunrise: Maybe<number>
  sunset: Maybe<number>
}

/** Chooses the background scene from real conditions and local solar time. */
export function selectScene(input: SceneInput): Scene {
  const { category, intensity } = getCondition(input.weatherCode)
  const isDay = input.isDay ?? true

  switch (category) {
    case 'unknown':
      return SCENES.neutral
    case 'thunderstorm':
    case 'thunderstorm-hail':
      return SCENES.storm
    case 'snow':
    case 'snow-grains':
    case 'snow-showers':
      return intensity === 'heavy' ? { ...SCENES.snow, effects: { ...SCENES.snow.effects, snow: 2 } } : SCENES.snow
    case 'rain':
    case 'rain-showers':
    case 'freezing-rain':
      return intensity === 'heavy' ? SCENES['heavy-rain'] : SCENES.rain
    case 'drizzle':
    case 'freezing-drizzle':
      return SCENES.rain
    case 'fog':
      return SCENES.fog
    case 'overcast':
      return isDay ? SCENES['overcast-day'] : SCENES['overcast-night']
    default:
      break
  }

  // Clear-ish skies: twilight colours are only visible without thick cloud.
  const near = (event: Maybe<number>) => event !== null && Math.abs(input.now - event) <= TWILIGHT_WINDOW_MS
  if (near(input.sunrise)) return SCENES.sunrise
  if (near(input.sunset)) return SCENES.sunset

  if (isDay && input.temperature !== null && input.temperature >= EXTREME_HEAT_C) return SCENES.heat

  if (category === 'partly-cloudy') return isDay ? SCENES['partly-day'] : SCENES['partly-night']
  return isDay ? SCENES['clear-day'] : SCENES['clear-night']
}

// ---------------------------------------------------------------------------
// Descriptive scales (labels only — no value judgements baked into colour)
// ---------------------------------------------------------------------------

/** WHO UV index exposure categories. */
export function uvCategory(uv: Maybe<number>): string {
  if (uv === null) return 'Unavailable'
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  if (uv < 11) return 'Very high'
  return 'Extreme'
}

export function uvAdvice(uv: Maybe<number>): string {
  if (uv === null) return 'No UV data from the provider.'
  if (uv < 3) return 'No protection needed for most people.'
  if (uv < 6) return 'Seek shade around midday; sunscreen advised.'
  if (uv < 8) return 'Protection needed: hat, sunscreen, shade.'
  if (uv < 11) return 'Extra protection needed; avoid midday sun.'
  return 'Avoid sun exposure; unprotected skin burns quickly.'
}

/** Beaufort scale from wind speed in km/h. */
export function beaufort(kmh: Maybe<number>): { force: number; label: string } | null {
  if (kmh === null) return null
  const scale: [max: number, label: string][] = [
    [1, 'Calm'],
    [5, 'Light air'],
    [11, 'Light breeze'],
    [19, 'Gentle breeze'],
    [28, 'Moderate breeze'],
    [38, 'Fresh breeze'],
    [49, 'Strong breeze'],
    [61, 'Near gale'],
    [74, 'Gale'],
    [88, 'Strong gale'],
    [102, 'Storm'],
    [117, 'Violent storm'],
  ]
  const force = scale.findIndex(([max]) => kmh < max)
  if (force === -1) return { force: 12, label: 'Hurricane force' }
  return { force, label: scale[force]![1] }
}

export function humidityLabel(rh: Maybe<number>): string {
  if (rh === null) return 'Unavailable'
  if (rh < 30) return 'Dry air'
  if (rh < 60) return 'Comfortable'
  if (rh < 80) return 'Humid'
  return 'Very humid'
}

/** Dew point (°C) is the better guide to how muggy the air feels. */
export function dewPointLabel(c: Maybe<number>): string {
  if (c === null) return 'Unavailable'
  if (c < 5) return 'Very dry'
  if (c < 10) return 'Dry'
  if (c < 16) return 'Comfortable'
  if (c < 19) return 'Slightly humid'
  if (c < 22) return 'Muggy'
  return 'Oppressive'
}

export function visibilityLabel(metres: Maybe<number>): string {
  if (metres === null) return 'Unavailable'
  if (metres < 1000) return 'Fog-level visibility'
  if (metres < 4000) return 'Poor'
  if (metres < 10_000) return 'Moderate'
  if (metres < 20_000) return 'Good'
  return 'Excellent'
}

export function cloudLabel(percent: Maybe<number>): string {
  if (percent === null) return 'Unavailable'
  if (percent < 10) return 'Clear'
  if (percent < 30) return 'Few clouds'
  if (percent < 60) return 'Scattered clouds'
  if (percent < 88) return 'Mostly cloudy'
  return 'Overcast'
}

/** Rate in mm/h (the provider's value is the sum over the preceding interval). */
export function precipitationRateLabel(mmPerHour: Maybe<number>): string {
  if (mmPerHour === null) return 'Unavailable'
  if (mmPerHour <= 0) return 'None'
  if (mmPerHour < 2.5) return 'Light'
  if (mmPerHour < 7.6) return 'Moderate'
  if (mmPerHour < 50) return 'Heavy'
  return 'Violent'
}

export function pressureTendencyLabel(deltaHpa: Maybe<number>): string {
  if (deltaHpa === null) return 'Trend unavailable'
  if (deltaHpa >= 1.5) return 'Rising'
  if (deltaHpa <= -1.5) return 'Falling'
  if (deltaHpa >= 0.4) return 'Rising slowly'
  if (deltaHpa <= -0.4) return 'Falling slowly'
  return 'Steady'
}

// ---------------------------------------------------------------------------
// Air quality index bands (the two scales are not interchangeable)
// ---------------------------------------------------------------------------

export interface AqiBand {
  max: number
  label: string
  color: string
  advice: string
}

/** European AQI (EEA) — https://airindex.eea.europa.eu */
export const EUROPEAN_AQI_BANDS: AqiBand[] = [
  { max: 20, label: 'Good', color: '#4fd1c5', advice: 'Air quality is good. Enjoy outdoor activities.' },
  { max: 40, label: 'Fair', color: '#68d391', advice: 'Acceptable air quality for most people.' },
  { max: 60, label: 'Moderate', color: '#ecc94b', advice: 'Sensitive groups may want to limit long exertion outdoors.' },
  { max: 80, label: 'Poor', color: '#ed8936', advice: 'Consider reducing intense outdoor activity.' },
  { max: 100, label: 'Very poor', color: '#e25563', advice: 'Reduce outdoor activity, especially if sensitive.' },
  { max: Infinity, label: 'Extremely poor', color: '#a855b5', advice: 'Avoid outdoor exertion.' },
]

/** US AQI (EPA) — https://www.airnow.gov/aqi/aqi-basics/ */
export const US_AQI_BANDS: AqiBand[] = [
  { max: 50, label: 'Good', color: '#68d391', advice: 'Air quality is satisfactory.' },
  { max: 100, label: 'Moderate', color: '#ecc94b', advice: 'Unusually sensitive people should consider limiting exertion.' },
  { max: 150, label: 'Unhealthy for sensitive groups', color: '#ed8936', advice: 'Sensitive groups should reduce outdoor exertion.' },
  { max: 200, label: 'Unhealthy', color: '#e25563', advice: 'Everyone may begin to feel effects; limit outdoor exertion.' },
  { max: 300, label: 'Very unhealthy', color: '#a855b5', advice: 'Avoid outdoor exertion.' },
  { max: Infinity, label: 'Hazardous', color: '#9b2c4d', advice: 'Stay indoors where possible.' },
]

export function aqiBand(value: Maybe<number>, bands: AqiBand[]): AqiBand | null {
  if (value === null) return null
  return bands.find((band) => value <= band.max) ?? bands[bands.length - 1]!
}

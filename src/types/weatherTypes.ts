/**
 * Normalised application data models.
 *
 * Canonical units (as requested from Open-Meteo, never converted in storage):
 *   temperature °C · wind km/h · precipitation mm · snowfall cm · pressure hPa
 *   visibility m · durations s · timestamps epoch milliseconds (UTC instants)
 *
 * `null` always means "the provider did not supply this value" — never zero.
 */

export type Maybe<T> = T | null

export interface GeoLocation {
  /** Stable identifier derived from rounded coordinates. */
  id: string
  name: string
  admin1?: string
  country?: string
  countryCode?: string
  latitude: number
  longitude: number
  timezone?: string
  elevation?: number
  population?: number
}

export interface CurrentWeather {
  /** Start of the model interval the values are valid for. */
  time: number
  /** Length of that interval in seconds (Open-Meteo: 900). */
  intervalSeconds: Maybe<number>
  temperature: Maybe<number>
  apparentTemperature: Maybe<number>
  humidity: Maybe<number>
  dewPoint: Maybe<number>
  isDay: Maybe<boolean>
  precipitation: Maybe<number>
  rain: Maybe<number>
  showers: Maybe<number>
  snowfall: Maybe<number>
  precipitationProbability: Maybe<number>
  weatherCode: Maybe<number>
  cloudCover: Maybe<number>
  pressureMsl: Maybe<number>
  surfacePressure: Maybe<number>
  windSpeed: Maybe<number>
  windDirection: Maybe<number>
  windGusts: Maybe<number>
  visibility: Maybe<number>
  uvIndex: Maybe<number>
}

export interface HourlyPoint {
  time: number
  temperature: Maybe<number>
  apparentTemperature: Maybe<number>
  humidity: Maybe<number>
  dewPoint: Maybe<number>
  precipitationProbability: Maybe<number>
  precipitation: Maybe<number>
  rain: Maybe<number>
  snowfall: Maybe<number>
  weatherCode: Maybe<number>
  cloudCover: Maybe<number>
  pressureMsl: Maybe<number>
  surfacePressure: Maybe<number>
  visibility: Maybe<number>
  windSpeed: Maybe<number>
  windDirection: Maybe<number>
  windGusts: Maybe<number>
  uvIndex: Maybe<number>
  isDay: Maybe<boolean>
  freezingLevel: Maybe<number>
}

export interface DailyPoint {
  /** Local midnight of the forecast day, as a UTC instant. */
  time: number
  weatherCode: Maybe<number>
  temperatureMax: Maybe<number>
  temperatureMin: Maybe<number>
  apparentMax: Maybe<number>
  apparentMin: Maybe<number>
  sunrise: Maybe<number>
  sunset: Maybe<number>
  daylightDuration: Maybe<number>
  sunshineDuration: Maybe<number>
  uvIndexMax: Maybe<number>
  precipitationSum: Maybe<number>
  rainSum: Maybe<number>
  snowfallSum: Maybe<number>
  precipitationHours: Maybe<number>
  precipitationProbabilityMax: Maybe<number>
  windSpeedMax: Maybe<number>
  windGustsMax: Maybe<number>
  windDirectionDominant: Maybe<number>
}

export interface WeatherData {
  latitude: number
  longitude: number
  elevation: Maybe<number>
  /** IANA time zone of the location, resolved by the provider. */
  timezone: string
  timezoneAbbreviation: string
  utcOffsetSeconds: number
  current: CurrentWeather
  hourly: HourlyPoint[]
  daily: DailyPoint[]
  /** When this app successfully received the response. */
  fetchedAt: number
}

export interface AirQualityHour {
  time: number
  europeanAqi: Maybe<number>
  usAqi: Maybe<number>
  pm25: Maybe<number>
  pm10: Maybe<number>
}

export interface AirQualityData {
  time: number
  timezone: string
  europeanAqi: Maybe<number>
  usAqi: Maybe<number>
  /** All pollutant concentrations in µg/m³. */
  pm25: Maybe<number>
  pm10: Maybe<number>
  nitrogenDioxide: Maybe<number>
  ozone: Maybe<number>
  sulphurDioxide: Maybe<number>
  carbonMonoxide: Maybe<number>
  /** Pollen in grains/m³ — only modelled for Europe during pollen season. */
  pollen: { key: string; label: string; value: number }[]
  hourly: AirQualityHour[]
  fetchedAt: number
}

export type TemperatureUnit = 'c' | 'f'
export type WindUnit = 'kmh' | 'ms' | 'mph' | 'kn'
export type PrecipitationUnit = 'mm' | 'in'
export type PressureUnit = 'hpa' | 'inhg'
export type DistanceUnit = 'km' | 'mi'
export type TimeFormat = 'auto' | '12' | '24'
export type EffectsLevel = 'full' | 'reduced' | 'off'

export interface UnitSettings {
  temperature: TemperatureUnit
  wind: WindUnit
  precipitation: PrecipitationUnit
  pressure: PressureUnit
  distance: DistanceUnit
}

export interface Settings {
  units: UnitSettings
  timeFormat: TimeFormat
  effects: EffectsLevel
}

import type { Maybe, TimeFormat, WeatherData } from '../types/weatherTypes'
import { formatHour, localHour } from './dateFormatting'
import type { Formatters } from './unitConversions'
import { getCondition } from './weatherConditions'
import { upcomingHours } from './weatherTransformers'

/**
 * Builds the short narrative under the hero temperature. Everything here is
 * a deterministic rule over the fetched data — no generated or invented text.
 */

function partOfDay(hour: number): string {
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

function thermalWord(feelsLikeC: number): string {
  if (feelsLikeC < -10) return 'Bitterly cold'
  if (feelsLikeC < 0) return 'Freezing'
  if (feelsLikeC < 8) return 'Cold'
  if (feelsLikeC < 15) return 'Cool'
  if (feelsLikeC < 21) return 'Mild'
  if (feelsLikeC < 27) return 'Warm'
  if (feelsLikeC < 33) return 'Hot'
  return 'Very hot'
}

function windPhrase(kmh: Maybe<number>): string | null {
  if (kmh === null) return null
  if (kmh < 6) return 'calm air'
  if (kmh < 20) return 'light winds'
  if (kmh < 39) return 'a moderate breeze'
  if (kmh < 62) return 'strong winds'
  return 'gale-force winds'
}

export function buildSummary(data: WeatherData, now: number, fmt: Formatters, timeFormat: TimeFormat): string {
  const { current, timezone } = data
  const feels = current.apparentTemperature ?? current.temperature
  if (feels === null) return 'Current conditions are not available for this location right now.'

  const condition = getCondition(current.weatherCode)
  const part = partOfDay(localHour(now, timezone))
  const wind = windPhrase(current.windSpeed)

  const sky = condition.category === 'unknown' ? '' : ` with ${condition.phrase}`
  const windPart = wind ? `${sky ? ' and ' : ' with '}${wind}` : ''
  const first = `${thermalWord(feels)} ${part}${sky}${windPart}.`

  const hours = upcomingHours(data.hourly, now, 13)
  const sentences = [first]

  // Temperature trend over the coming hours.
  const temps = hours.slice(1).filter((h) => h.temperature !== null)
  if (current.temperature !== null && temps.length >= 4) {
    const base = current.temperature
    const peak = temps.reduce((a, b) => (b.temperature! > a.temperature! ? b : a))
    const trough = temps.reduce((a, b) => (b.temperature! < a.temperature! ? b : a))
    const rise = peak.temperature! - base
    const fall = base - trough.temperature!
    if (rise >= 3 && rise >= fall) {
      sentences.push(
        `Temperatures climb to around ${fmt.temp(peak.temperature).text} by ${formatHour(peak.time, timezone, timeFormat)}.`,
      )
    } else if (fall >= 3) {
      sentences.push(
        `Temperatures drop to around ${fmt.temp(trough.temperature).text} by ${formatHour(trough.time, timezone, timeFormat)}.`,
      )
    } else {
      sentences.push('Temperatures stay fairly steady over the next 12 hours.')
    }
  }

  // Precipitation outlook.
  const upcoming = hours.slice(1)
  const wetNow = condition.wet || (current.precipitation ?? 0) > 0
  if (wetNow) {
    const dryAt = upcoming.find(
      (h) => !getCondition(h.weatherCode).wet && (h.precipitation ?? 0) === 0 && (h.precipitationProbability ?? 0) < 40,
    )
    sentences.push(
      dryAt
        ? `Drier conditions are expected from about ${formatHour(dryAt.time, timezone, timeFormat)}.`
        : 'Precipitation is likely to continue through the next 12 hours.',
    )
  } else {
    const wetAt = upcoming.find((h) => (h.precipitationProbability ?? 0) >= 50 || (h.precipitation ?? 0) >= 0.2)
    if (wetAt) {
      const c = getCondition(wetAt.weatherCode)
      const what = c.frozen ? 'Snow or ice' : c.category.startsWith('thunderstorm') ? 'Thunderstorms' : 'Rain'
      const chance =
        wetAt.precipitationProbability !== null ? ` (${Math.round(wetAt.precipitationProbability)}% chance)` : ''
      sentences.push(`${what} possible from about ${formatHour(wetAt.time, timezone, timeFormat)}${chance}.`)
    } else if (upcoming.length >= 6 && upcoming.every((h) => h.precipitationProbability !== null)) {
      const max = Math.max(...upcoming.map((h) => h.precipitationProbability!))
      if (max < 20) sentences.push('No precipitation is expected in the next 12 hours.')
    }
  }

  return sentences.slice(0, 3).join(' ')
}

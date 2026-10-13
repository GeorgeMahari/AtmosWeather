import type { TimeFormat } from '../types/weatherTypes'

/**
 * All timestamps in the app are UTC instants (epoch ms). They are rendered in
 * the *location's* IANA time zone, never the browser's.
 */

const locale = () => (typeof navigator !== 'undefined' ? navigator.language : undefined)

const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = `${timeZone}|${key}`
  let f = cache.get(id)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale(), { ...options, timeZone })
    } catch {
      // Unknown zone identifier: fall back to UTC rather than crash.
      f = new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'UTC' })
    }
    cache.set(id, f)
  }
  return f
}

const hourCycle = (format: TimeFormat): Pick<Intl.DateTimeFormatOptions, 'hour12'> =>
  format === 'auto' ? {} : { hour12: format === '12' }

/** "14:35" / "2:35 PM" */
export function formatTime(ms: number, timeZone: string, format: TimeFormat = 'auto'): string {
  return formatter(timeZone, `time:${format}`, { hour: 'numeric', minute: '2-digit', ...hourCycle(format) }).format(ms)
}

/** "14:00" / "2 PM" — compact label for hourly slots. */
export function formatHour(ms: number, timeZone: string, format: TimeFormat = 'auto'): string {
  const f = formatter(timeZone, `hour:${format}`, { hour: 'numeric', minute: '2-digit', ...hourCycle(format) })
  const usesDayPeriod = f.resolvedOptions().hour12 === true
  if (!usesDayPeriod) return f.format(ms)
  return formatter(timeZone, `hour-short:${format}`, { hour: 'numeric', ...hourCycle(format) }).format(ms)
}

/** "Tuesday, 13 October" */
export function formatLongDate(ms: number, timeZone: string): string {
  return formatter(timeZone, 'long-date', { weekday: 'long', day: 'numeric', month: 'long' }).format(ms)
}

/** "13 Oct" */
export function formatShortDate(ms: number, timeZone: string): string {
  return formatter(timeZone, 'short-date', { day: 'numeric', month: 'short' }).format(ms)
}

export function formatWeekday(ms: number, timeZone: string, style: 'short' | 'long' = 'short'): string {
  return formatter(timeZone, `weekday:${style}`, { weekday: style }).format(ms)
}

/** "Tue 14:00" — chart axes spanning several days. */
export function formatWeekdayHour(ms: number, timeZone: string, format: TimeFormat = 'auto'): string {
  return `${formatWeekday(ms, timeZone)} ${formatHour(ms, timeZone, format)}`
}

/** Hour of day (0–23, fractional) in the given zone. */
export function localHour(ms: number, timeZone: string): number {
  const parts = formatter(timeZone, 'parts', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (get('hour') % 24) + get('minute') / 60
}

/** "2026-10-13" in the given zone — for comparing calendar days. */
export function localDayKey(ms: number, timeZone: string): string {
  return formatter(timeZone, 'day-key', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(ms)
    .filter((p) => p.type !== 'literal')
    .map((p) => `${p.type}${p.value}`)
    .join('-')
}

const relative = () => new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' })

/** "just now", "3 min. ago", "2 hr. ago" */
export function formatRelative(ms: number, now: number): string {
  const seconds = Math.round((ms - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  if (abs < 3600) return relative().format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relative().format(Math.round(seconds / 3600), 'hour')
  return relative().format(Math.round(seconds / 86_400), 'day')
}

/** "in 2h 05m" style countdown body: "2h 05m". */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

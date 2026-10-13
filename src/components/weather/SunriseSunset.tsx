import { Sunrise, Sunset } from 'lucide-react'
import { useSettings } from '../../app/SettingsContext'
import type { DailyPoint, Maybe, WeatherData } from '../../types/weatherTypes'
import { formatCountdown, formatTime } from '../../utils/dateFormatting'
import { solarPhase, solarPosition } from '../../utils/solar'
import { UNAVAILABLE, formatDuration, formatNumber } from '../../utils/unitConversions'

interface SunriseSunsetProps {
  data: WeatherData
  today: DailyPoint | undefined
  tomorrow: DailyPoint | undefined
  now: number
}

function nextEvent(today: DailyPoint | undefined, tomorrow: DailyPoint | undefined, now: number) {
  const candidates: { label: string; at: Maybe<number> }[] = [
    { label: 'Sunrise', at: today?.sunrise ?? null },
    { label: 'Sunset', at: today?.sunset ?? null },
    { label: 'Sunrise', at: tomorrow?.sunrise ?? null },
  ]
  return candidates.find((c): c is { label: string; at: number } => c.at !== null && c.at > now) ?? null
}

export function SunriseSunset({ data, today, tomorrow, now }: SunriseSunsetProps) {
  const { settings } = useSettings()
  const sunrise = today?.sunrise ?? null
  const sunset = today?.sunset ?? null
  const time = (ms: Maybe<number>) => (ms === null ? UNAVAILABLE : formatTime(ms, data.timezone, settings.timeFormat))
  const upcoming = nextEvent(today, tomorrow, now)
  const sun = solarPosition(now, data.latitude, data.longitude)

  // Position along the day arc: 0 at sunrise, 1 at sunset.
  const hasArc = sunrise !== null && sunset !== null && sunset > sunrise
  const progress = hasArc ? (now - sunrise) / (sunset - sunrise) : null
  const up = progress !== null && progress >= 0 && progress <= 1
  const t = Math.min(1, Math.max(0, progress ?? 0))
  // Quadratic Bézier from (16,70) via (120,-34) to (224,70).
  const bx = (1 - t) ** 2 * 16 + 2 * (1 - t) * t * 120 + t ** 2 * 224
  const by = (1 - t) ** 2 * 70 + 2 * (1 - t) * t * -34 + t ** 2 * 70

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <svg
        viewBox="0 0 240 84"
        role="img"
        aria-label={
          hasArc
            ? up
              ? `The sun is up, ${Math.round(t * 100)}% of the way from sunrise to sunset`
              : 'The sun is below the horizon'
            : 'Sunrise and sunset times are unavailable for this day'
        }
        className="w-full"
      >
        <line x1="6" y1="70" x2="234" y2="70" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1" />
        <path d="M16 70 Q120 -34 224 70" fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="1.5" strokeDasharray="3 4" />
        {hasArc && up && (
          <>
            <path
              // Elapsed part of the arc: the curve split at t (de Casteljau).
              d={`M16 70 Q${16 + (120 - 16) * t} ${70 + (-34 - 70) * t} ${bx} ${by}`}
              fill="none"
              stroke="var(--color-amber)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx={bx} cy={by} r="9" fill="rgb(251 191 36 / 0.25)" />
            <circle cx={bx} cy={by} r="4.5" fill="var(--color-amber)" stroke="var(--color-surface)" strokeWidth="1.5" />
          </>
        )}
        <circle cx="16" cy="70" r="2.5" fill="var(--color-ink-mute)" />
        <circle cx="224" cy="70" r="2.5" fill="var(--color-ink-mute)" />
      </svg>

      <div className="tabular mt-1 flex justify-between text-sm">
        <p className="flex items-center gap-2">
          <Sunrise aria-hidden="true" className="size-4 text-amber" />
          <span>
            <span className="sr-only">Sunrise </span>
            <span className="font-medium text-ink">{time(sunrise)}</span>
          </span>
        </p>
        <p className="flex items-center gap-2">
          <span>
            <span className="sr-only">Sunset </span>
            <span className="font-medium text-ink">{time(sunset)}</span>
          </span>
          <Sunset aria-hidden="true" className="size-4 text-amber" />
        </p>
      </div>

      <dl className="tabular mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-mute">{upcoming ? `${upcoming.label} in` : 'Next sun event'}</dt>
          <dd className="font-medium text-ink">{upcoming ? formatCountdown(upcoming.at - now) : UNAVAILABLE}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-mute">Daylight</dt>
          <dd className="font-medium text-ink">{formatDuration(today?.daylightDuration ?? null)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-mute">Solar elevation (calculated)</dt>
          <dd className="font-medium text-ink">
            {formatNumber(sun.elevation, 1)}° <span className="font-normal text-ink-mute">· {solarPhase(sun.elevation)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-mute">Forecast sunshine today</dt>
          <dd className="font-medium text-ink">{formatDuration(today?.sunshineDuration ?? null)}</dd>
        </div>
      </dl>
    </div>
  )
}

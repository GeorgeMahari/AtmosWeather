import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Droplet, Navigation2 } from 'lucide-react'
import { useSettings } from '../../app/SettingsContext'
import type { HourlyPoint, WeatherData } from '../../types/weatherTypes'
import { formatHour, formatWeekdayHour } from '../../utils/dateFormatting'
import { cardinalDirection } from '../../utils/unitConversions'
import { getCondition } from '../../utils/weatherConditions'
import { upcomingHours } from '../../utils/weatherTransformers'
import { HourlyTempChart } from '../charts/lazy'
import { Section, cx } from '../common/primitives'
import { WeatherIcon } from './WeatherIcon'

interface HourlyForecastProps {
  data: WeatherData
  now: number
}

const HOUR = 3_600_000

function HourDetails({ hour, timezone }: { hour: HourlyPoint; timezone: string }) {
  const { settings, fmt } = useSettings()
  const items: [label: string, value: string][] = [
    ['Feels like', fmt.temp(hour.apparentTemperature).text],
    ['Precip. chance', fmt.percent(hour.precipitationProbability).text],
    ['Precipitation', fmt.precip(hour.precipitation).text],
    ['Wind', hour.windSpeed === null ? '—' : `${fmt.wind(hour.windSpeed).text} ${cardinalDirection(hour.windDirection)}`],
    ['Gusts', fmt.wind(hour.windGusts).text],
    ['Humidity', fmt.percent(hour.humidity).text],
    ['Cloud cover', fmt.percent(hour.cloudCover).text],
    ['UV index', fmt.plain(hour.uvIndex, 1).text],
    ['Pressure', fmt.pressure(hour.pressureMsl).text],
    ['Visibility', fmt.distance(hour.visibility).text],
  ]
  return (
    <div className="mt-4 border-t border-line pt-4" aria-live="polite">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
        <WeatherIcon code={hour.weatherCode} isDay={hour.isDay ?? true} className="size-5" />
        <span className="font-medium text-ink">{formatWeekdayHour(hour.time, timezone, settings.timeFormat)}</span>
        <span>
          {getCondition(hour.weatherCode).description}, {fmt.tempFull(hour.temperature, 1).text}
        </span>
      </p>
      <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-mute">{label}</dt>
            <dd className="font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export const HourlyForecast = memo(function HourlyForecast({ data, now }: HourlyForecastProps) {
  const { settings, fmt } = useSettings()
  // Re-slice only when the hour rolls over, not on every clock tick.
  const hourBucket = Math.floor(now / HOUR)
  const hours = useMemo(
    () => upcomingHours(data.hourly, hourBucket * HOUR, 24),
    [data.hourly, hourBucket],
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const stripRef = useRef<HTMLUListElement>(null)

  const selectedHour = hours.find((h) => h.time === selected) ?? hours[0]
  const selectedTime = selectedHour?.time ?? null

  // A new location or a rolled-over day can leave the old selection off-range.
  useEffect(() => setSelected(null), [data.latitude, data.longitude])

  const selectFromChart = useCallback((t: number) => {
    setSelected(t)
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-time="${t}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [])

  if (hours.length === 0 || !selectedHour) return null

  return (
    <Section
      id="hourly"
      title="Next 24 hours"
      subtitle="Select an hour in the chart or the list for the full breakdown. Times are local to the selected place."
    >
      <div className="glass p-4 sm:p-5">
        <HourlyTempChart
          hours={hours}
          timezone={data.timezone}
          now={now}
          selected={selectedTime}
          onHover={setHovered}
          onSelect={selectFromChart}
        />

        <ul
          ref={stripRef}
          aria-label="Hourly forecast"
          // `relative` keeps visually-hidden labels inside this scroll container.
          className="thin-scrollbar relative -mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5"
        >
          {hours.map((hour, index) => {
            const isSelected = hour.time === selectedTime
            const isHovered = hour.time === hovered
            const pop = hour.precipitationProbability
            return (
              <li key={hour.time} className="snap-start">
                <button
                  type="button"
                  data-time={hour.time}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(hour.time)}
                  className={cx(
                    'tabular flex w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors',
                    isSelected
                      ? 'border-accent/50 bg-accent/15'
                      : isHovered
                        ? 'border-white/25 bg-white/10'
                        : 'border-transparent bg-white/5 hover:bg-white/10',
                  )}
                >
                  <span className="text-xs text-ink-soft">
                    {index === 0 ? 'Now' : formatHour(hour.time, data.timezone, settings.timeFormat)}
                  </span>
                  <WeatherIcon code={hour.weatherCode} isDay={hour.isDay ?? true} className="size-6" labelled />
                  <span className="text-base font-semibold text-ink">{fmt.temp(hour.temperature).text}</span>
                  <span className="flex items-center gap-0.5 text-[0.6875rem] text-ink-soft">
                    <Droplet aria-hidden="true" className="size-3 text-cyan" />
                    <span className="sr-only">Precipitation chance </span>
                    {fmt.percent(pop).text}
                  </span>
                  <span className="flex items-center gap-0.5 text-[0.6875rem] text-ink-mute">
                    <Navigation2
                      aria-hidden="true"
                      className="size-3"
                      style={{ transform: `rotate(${(hour.windDirection ?? 0) + 180}deg)`, opacity: hour.windDirection === null ? 0.3 : 1 }}
                    />
                    <span className="sr-only">Wind </span>
                    {fmt.wind(hour.windSpeed).value}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-1 text-[0.6875rem] text-ink-mute">Wind in {fmt.wind(0).unit}; arrows show where the wind is heading.</p>

        <HourDetails hour={selectedHour} timezone={data.timezone} />
      </div>
    </Section>
  )
})

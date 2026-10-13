import { memo, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Droplet } from 'lucide-react'
import { useSettings } from '../../app/SettingsContext'
import type { DailyPoint, WeatherData } from '../../types/weatherTypes'
import { formatShortDate, formatTime, formatWeekday } from '../../utils/dateFormatting'
import { cardinalDirection, formatDuration, formatNumber } from '../../utils/unitConversions'
import { getCondition, uvCategory } from '../../utils/weatherConditions'
import { hoursOfDay, todayIndex } from '../../utils/weatherTransformers'
import { DailyRangeChart } from '../charts/lazy'
import { Section, Sparkline, cx } from '../common/primitives'
import { WeatherIcon } from './WeatherIcon'

interface DailyForecastProps {
  data: WeatherData
  now: number
}

interface DayRowProps {
  day: DailyPoint
  label: string
  data: WeatherData
  dayIndex: number
  /** Coldest low / warmest high across the whole forecast, for the range bar. */
  span: { min: number; max: number } | null
  open: boolean
  onToggle: () => void
}

function DayRow({ day, label, data, dayIndex, span, open, onToggle }: DayRowProps) {
  const { settings, fmt } = useSettings()
  const condition = getCondition(day.weatherCode)
  const panelId = `day-panel-${day.time}`
  const time = (ms: number | null) => (ms === null ? '—' : formatTime(ms, data.timezone, settings.timeFormat))
  const dayHours = useMemo(() => (open ? hoursOfDay(data.hourly, data.daily, dayIndex) : []), [open, data, dayIndex])

  const bar =
    span && day.temperatureMin !== null && day.temperatureMax !== null && span.max > span.min
      ? {
          left: ((day.temperatureMin - span.min) / (span.max - span.min)) * 100,
          width: Math.max(4, ((day.temperatureMax - day.temperatureMin) / (span.max - span.min)) * 100),
        }
      : null

  const details: [label: string, value: string][] = [
    ['Feels like', `${fmt.temp(day.apparentMin).text} to ${fmt.temp(day.apparentMax).text}`],
    ['Precipitation', `${fmt.precip(day.precipitationSum).text}${day.precipitationHours !== null ? ` over ${formatNumber(day.precipitationHours)} h` : ''}`],
    ['Rain', fmt.precip(day.rainSum).text],
    ['Snowfall', fmt.snow(day.snowfallSum).text],
    [
      'Wind',
      day.windSpeedMax === null ? '—' : `up to ${fmt.wind(day.windSpeedMax).text} ${cardinalDirection(day.windDirectionDominant)}`,
    ],
    ['Gusts', fmt.wind(day.windGustsMax).text],
    ['UV index max', day.uvIndexMax === null ? '—' : `${formatNumber(day.uvIndexMax, 1)} · ${uvCategory(day.uvIndexMax)}`],
    ['Sunrise / sunset', `${time(day.sunrise)} / ${time(day.sunset)}`],
    ['Daylight', formatDuration(day.daylightDuration)],
    ['Sunshine', formatDuration(day.sunshineDuration)],
  ]

  return (
    <li className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="tabular grid w-full grid-cols-[minmax(0,4.5rem)_1.75rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 px-4 py-3 text-left transition-colors hover:bg-white/5 sm:grid-cols-[minmax(0,7rem)_1.75rem_minmax(0,1.1fr)_4.5rem_minmax(0,1.3fr)_1rem] sm:px-5"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{label}</span>
            <span className="block text-xs text-ink-mute">{formatShortDate(day.time, data.timezone)}</span>
          </span>
          <WeatherIcon code={day.weatherCode} isDay className="size-6" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink-soft">{condition.description}</span>
            <span className="flex items-center gap-1 text-xs text-ink-mute sm:hidden">
              <Droplet aria-hidden="true" className="size-3 text-cyan" />
              <span className="sr-only">Precipitation chance </span>
              {fmt.percent(day.precipitationProbabilityMax).text}
              {day.precipitationSum !== null && day.precipitationSum > 0 && ` · ${fmt.precip(day.precipitationSum).text}`}
            </span>
          </span>
          <span className="hidden text-xs text-ink-soft sm:block">
            <span className="flex items-center gap-1">
              <Droplet aria-hidden="true" className="size-3 text-cyan" />
              <span className="sr-only">Precipitation chance </span>
              {fmt.percent(day.precipitationProbabilityMax).text}
            </span>
            <span className="block text-ink-mute">{fmt.precip(day.precipitationSum).text}</span>
          </span>
          <span className="flex items-center gap-2 text-sm">
            <span className="w-9 text-right text-ink-mute">
              <span className="sr-only">Low </span>
              {fmt.temp(day.temperatureMin).text}
            </span>
            <span aria-hidden="true" className="relative hidden h-1.5 flex-1 rounded-full bg-white/10 sm:block">
              {bar && (
                <span
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-300 to-amber-300"
                  style={{ left: `${bar.left}%`, width: `${Math.min(bar.width, 100 - bar.left)}%` }}
                />
              )}
            </span>
            <span className="w-9 font-semibold text-ink">
              <span className="sr-only">High </span>
              {fmt.temp(day.temperatureMax).text}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className={cx('size-4 text-ink-mute transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-1 pb-5 sm:px-5">
              <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {details.map(([name, value]) => (
                  <div key={name}>
                    <dt className="text-xs text-ink-mute">{name}</dt>
                    <dd className="font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              {dayHours.length > 2 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-ink-mute">Temperature through the day (00–24 h local)</p>
                  <Sparkline values={dayHours.map((h) => h.temperature)} label={`Hourly temperature trend for ${label}`} className="h-10" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export const DailyForecast = memo(function DailyForecast({ data, now }: DailyForecastProps) {
  const [openDay, setOpenDay] = useState<number | null>(null)
  const today = todayIndex(data.daily, now)
  const days = useMemo(() => data.daily.slice(Math.max(0, today)), [data.daily, today])

  useEffect(() => setOpenDay(null), [data.latitude, data.longitude])

  const span = useMemo(() => {
    const lows = days.flatMap((d) => (d.temperatureMin === null ? [] : [d.temperatureMin]))
    const highs = days.flatMap((d) => (d.temperatureMax === null ? [] : [d.temperatureMax]))
    return lows.length && highs.length ? { min: Math.min(...lows), max: Math.max(...highs) } : null
  }, [days])

  if (days.length === 0) return null

  return (
    <Section
      id="daily"
      title={`${days.length}-day forecast`}
      subtitle="Exactly the days the provider returned — nothing is extrapolated. Expand a day for details."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start">
        <ul className="glass overflow-hidden">
          {days.map((day, index) => (
            <DayRow
              key={day.time}
              day={day}
              label={index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : formatWeekday(day.time, data.timezone, 'long')}
              data={data}
              dayIndex={Math.max(0, today) + index}
              span={span}
              open={openDay === day.time}
              onToggle={() => setOpenDay((current) => (current === day.time ? null : day.time))}
            />
          ))}
        </ul>
        <div className="glass p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-medium text-ink-soft">Daily highs and lows</h3>
          <DailyRangeChart daily={days} timezone={data.timezone} />
        </div>
      </div>
    </Section>
  )
})

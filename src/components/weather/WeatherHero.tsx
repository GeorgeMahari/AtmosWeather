import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, Columns3, Droplets, Navigation2, Share2, Star, Sun, Umbrella } from 'lucide-react'
import { MAX_COMPARE, useLocations } from '../../app/LocationsContext'
import { useSettings } from '../../app/SettingsContext'
import type { GeoLocation, WeatherData } from '../../types/weatherTypes'
import { formatLongDate, formatTime } from '../../utils/dateFormatting'
import { UNIT_LABELS, cardinalDirection, convertTemperature } from '../../utils/unitConversions'
import { getCondition, uvCategory } from '../../utils/weatherConditions'
import { buildSummary } from '../../utils/weatherSummary'
import { locationSubtitle, todayIndex, withHourlyFallback } from '../../utils/weatherTransformers'
import { AnimatedNumber } from '../common/AnimatedNumber'
import { cx } from '../common/primitives'
import { WeatherIcon } from './WeatherIcon'

interface WeatherHeroProps {
  location: GeoLocation
  data: WeatherData
  now: number
}

function ShareButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const id = window.setTimeout(() => setState('idle'), 2200)
    return () => window.clearTimeout(id)
  }, [state])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <button type="button" className="chip" onClick={share}>
      {state === 'copied' ? <Check aria-hidden="true" className="size-3.5" /> : <Share2 aria-hidden="true" className="size-3.5" />}
      <span aria-live="polite">
        {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy the address bar URL' : 'Share'}
      </span>
    </button>
  )
}

export function WeatherHero({ location, data, now }: WeatherHeroProps) {
  const { settings, fmt } = useSettings()
  const { isFavorite, toggleFavorite, compare, addCompare, favorites, recents, selectLocation } = useLocations()
  const current = withHourlyFallback(data, now)
  const today = data.daily[todayIndex(data.daily, now)]
  const condition = getCondition(current.weatherCode)
  const isDay = current.isDay ?? true
  const favorite = isFavorite(location.id)
  const inCompare = compare.some((item) => item.id === location.id)
  const temperature = current.temperature === null ? null : convertTemperature(current.temperature, settings.units.temperature)
  const summary = buildSummary(data, now, fmt, settings.timeFormat)
  const subtitle = locationSubtitle(location)

  const favoriteIds = new Set(favorites.map((f) => f.id))
  const quick = [...favorites, ...recents.filter((r) => !favoriteIds.has(r.id))].filter((l) => l.id !== location.id).slice(0, 8)

  const stats = [
    {
      icon: <Droplets aria-hidden="true" className="size-4" />,
      label: 'Humidity',
      value: fmt.percent(current.humidity).text,
    },
    {
      icon: (
        <Navigation2
          aria-hidden="true"
          className="size-4 transition-transform duration-700"
          // The arrow points where the wind is heading (direction + 180°).
          style={{ transform: `rotate(${(current.windDirection ?? 0) + 180}deg)`, opacity: current.windDirection === null ? 0.4 : 1 }}
        />
      ),
      label: 'Wind',
      value:
        current.windSpeed === null
          ? fmt.wind(null).text
          : `${fmt.wind(current.windSpeed).text} ${cardinalDirection(current.windDirection)}`.trim(),
    },
    {
      icon: <Umbrella aria-hidden="true" className="size-4" />,
      label: 'Precip. chance',
      value: fmt.percent(current.precipitationProbability).text,
    },
    {
      icon: <Sun aria-hidden="true" className="size-4" />,
      label: 'UV index',
      value: current.uvIndex === null ? fmt.plain(null).text : `${fmt.plain(current.uvIndex, 1).value} · ${uvCategory(current.uvIndex)}`,
    },
  ]

  return (
    <section id="now" aria-labelledby="now-title">
      <motion.div
        key={location.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="hero-text grid gap-8 pt-6 pb-2 sm:pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end"
      >
        <div className="min-w-0">
          <h1 id="now-title" className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
            {location.name}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft sm:text-base">
            {subtitle && <span>{subtitle} · </span>}
            <time dateTime={new Date(now).toISOString()} className="tabular">
              {formatLongDate(now, data.timezone)}, {formatTime(now, data.timezone, settings.timeFormat)}
            </time>
            {data.timezoneAbbreviation && <span className="text-ink-mute"> {data.timezoneAbbreviation}</span>}
          </p>

          <div className="mt-6 flex items-center gap-4 sm:gap-6">
            <WeatherIcon code={current.weatherCode} isDay={isDay} animated className="size-20 flex-none sm:size-28" />
            <div className="min-w-0">
              <p className="flex items-start leading-none font-extralight tracking-tighter text-ink">
                <AnimatedNumber value={temperature} className="text-[5.5rem] sm:text-[8rem] lg:text-[9.5rem]" />
                <span className="mt-2 text-3xl font-light tracking-normal text-ink-soft sm:mt-4 sm:text-5xl">
                  {UNIT_LABELS.temperature[settings.units.temperature]}
                </span>
              </p>
            </div>
          </div>

          <p className="mt-2 text-xl font-medium text-ink sm:text-2xl">{condition.description}</p>
          <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft sm:text-base">
            <span>Feels like {fmt.temp(current.apparentTemperature).text}</span>
            <span className="inline-flex items-center gap-1">
              <ArrowUp aria-hidden="true" className="size-4 text-amber" />
              <span className="sr-only">High</span>
              {fmt.temp(today?.temperatureMax ?? null).text}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown aria-hidden="true" className="size-4 text-ice" />
              <span className="sr-only">Low</span>
              {fmt.temp(today?.temperatureMin ?? null).text}
            </span>
          </p>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-ink-soft">{summary}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <dl className="glass grid grid-cols-2 gap-px overflow-hidden bg-white/5 [text-shadow:none]">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[rgb(8_14_28/0.35)] px-4 py-3.5">
                <dt className="flex items-center gap-2 text-xs text-ink-mute">
                  <span className="text-accent">{stat.icon}</span>
                  {stat.label}
                </dt>
                <dd className="tabular mt-1 text-lg font-medium text-ink">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 [text-shadow:none]">
            <button type="button" className="chip" aria-pressed={favorite} onClick={() => toggleFavorite(location)}>
              <Star aria-hidden="true" className={cx('size-3.5', favorite && 'fill-amber text-amber')} />
              {favorite ? 'Saved' : 'Save place'}
            </button>
            <button
              type="button"
              className="chip"
              disabled={inCompare || compare.length >= MAX_COMPARE}
              onClick={() => addCompare(location)}
              title={!inCompare && compare.length >= MAX_COMPARE ? `Comparison holds up to ${MAX_COMPARE} places` : undefined}
            >
              <Columns3 aria-hidden="true" className="size-3.5" />
              {inCompare ? 'In comparison' : 'Add to compare'}
            </button>
            <ShareButton />
          </div>
        </div>
      </motion.div>

      {quick.length > 0 && (
        <nav aria-label="Saved and recent places" className="mt-5">
          <ul className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
            {quick.map((place) => (
              <li key={place.id}>
                <button type="button" className="chip" onClick={() => selectLocation(place)}>
                  {favoriteIds.has(place.id) && <Star aria-hidden="true" className="size-3 fill-amber text-amber" />}
                  {place.name}
                  {place.countryCode && <span className="text-ink-mute">{place.countryCode}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="tabular mt-4 text-xs text-ink-mute">
        Forecast-model conditions for the {current.intervalSeconds ? `${Math.round(current.intervalSeconds / 60)}-minute` : ''} interval
        starting {formatTime(current.time, data.timezone, settings.timeFormat)} local — not a station observation. Received{' '}
        {formatTime(data.fetchedAt, data.timezone, settings.timeFormat)}.
      </p>
    </section>
  )
}

import { memo, useCallback, useMemo, useRef } from 'react'
import { Columns3, X } from 'lucide-react'
import { MAX_COMPARE, useLocations } from '../../app/LocationsContext'
import { useSettings } from '../../app/SettingsContext'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { describeError } from '../../services/http'
import { fetchForecast } from '../../services/weatherApi'
import type { GeoLocation, WeatherData } from '../../types/weatherTypes'
import { formatTime, formatWeekday } from '../../utils/dateFormatting'
import { cardinalDirection } from '../../utils/unitConversions'
import { getCondition } from '../../utils/weatherConditions'
import { locationSubtitle, todayIndex, upcomingHours, withHourlyFallback } from '../../utils/weatherTransformers'
import { CompareChart } from '../charts/lazy'
import type { CompareSeriesInput } from '../charts/WeatherChartViews'
import { SERIES_COLORS } from '../charts/palette'
import { EmptyState, Section, Skeleton } from '../common/primitives'
import { LocationSearch } from '../layout/LocationSearch'
import { WeatherIcon } from './WeatherIcon'

type Result = { data: WeatherData } | { error: string }

/**
 * Each compared place keeps a palette slot for as long as it stays in the
 * list, so removing one place never recolours the others.
 */
function useStableSlots(ids: string[]): Map<string, number> {
  const slots = useRef(new Map<string, number>())
  return useMemo(() => {
    const current = slots.current
    for (const id of [...current.keys()]) if (!ids.includes(id)) current.delete(id)
    for (const id of ids) {
      if (current.has(id)) continue
      const used = new Set(current.values())
      let slot = 0
      while (used.has(slot)) slot++
      current.set(id, slot)
    }
    return new Map(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')])
}

interface CompareLocationsProps {
  now: number
}

const HOUR = 3_600_000

export const CompareLocations = memo(function CompareLocations({ now }: CompareLocationsProps) {
  const { compare, addCompare, removeCompare, selectLocation, location, favorites, recents } = useLocations()
  const { settings, fmt } = useSettings()
  const ids = compare.map((c) => c.id)
  const key = ids.length ? ids.join('|') : null
  const slots = useStableSlots(ids)

  const load = useCallback(
    async (signal: AbortSignal, force: boolean) => {
      const settled = await Promise.allSettled(compare.map((place) => fetchForecast(place, { signal, force })))
      return new Map<string, Result>(
        settled.map((result, i) => [
          compare[i]!.id,
          result.status === 'fulfilled' ? { data: result.value } : { error: describeError(result.reason) },
        ]),
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  const results = useAsyncResource(key, load)

  const hourBucket = Math.floor(now / HOUR)
  const chartItems = useMemo<CompareSeriesInput[]>(() => {
    if (!results.data) return []
    return compare.flatMap((place) => {
      const result = results.data!.get(place.id)
      if (!result || 'error' in result) return []
      return [
        {
          id: place.id,
          name: place.name,
          slot: slots.get(place.id) ?? 0,
          hours: upcomingHours(result.data.hourly, hourBucket * HOUR, 48),
        },
      ]
    })
  }, [results.data, compare, slots, hourBucket])

  const full = compare.length >= MAX_COMPARE
  const suggestions = useMemo(() => {
    const taken = new Set(ids)
    const seen = new Set<string>()
    return [...(location ? [location] : []), ...favorites, ...recents]
      .filter((place) => {
        if (taken.has(place.id) || seen.has(place.id)) return false
        seen.add(place.id)
        return true
      })
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, location, favorites, recents])

  return (
    <Section
      id="compare"
      title="Compare locations"
      subtitle={`Put up to ${MAX_COMPARE} places side by side. Each column uses that place's own local time.`}
    >
      <div className="glass p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {full ? (
            <p className="text-sm text-ink-mute">Comparison is full — remove a place to add another.</p>
          ) : (
            <>
              <LocationSearch
                className="w-full sm:w-72"
                onSelect={addCompare}
                placeholder="Add a place to compare"
                label="Search for a place to add to the comparison"
              />
              {suggestions.map((place: GeoLocation) => (
                <button key={place.id} type="button" className="chip" onClick={() => addCompare(place)}>
                  + {place.name}
                </button>
              ))}
            </>
          )}
        </div>

        {compare.length === 0 ? (
          <EmptyState
            icon={<Columns3 aria-hidden="true" className="size-7" />}
            title="Nothing to compare yet"
            message="Search for a place above, or add the current location, to see conditions side by side."
          />
        ) : (
          <>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {compare.map((place) => {
                const result = results.data?.get(place.id)
                const color = SERIES_COLORS[(slots.get(place.id) ?? 0) % SERIES_COLORS.length]
                return (
                  <li key={place.id} className="relative rounded-2xl border border-line bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <span aria-hidden="true" className="h-0.5 w-3 flex-none rounded-full" style={{ background: color }} />
                          <span className="truncate">{place.name}</span>
                        </p>
                        <p className="truncate text-xs text-ink-mute">{locationSubtitle(place) || 'Coordinates'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompare(place.id)}
                        aria-label={`Remove ${place.name} from comparison`}
                        className="-mt-1 -mr-1 grid size-8 flex-none place-items-center rounded-lg text-ink-mute hover:bg-white/10 hover:text-ink"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </div>

                    {!result ? (
                      results.error ? (
                        <p role="alert" className="mt-4 text-sm text-amber">
                          {results.error}
                        </p>
                      ) : (
                        <div role="status" aria-label={`Loading ${place.name}`} className="mt-4 space-y-2">
                          <Skeleton className="h-10 w-24" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      )
                    ) : 'error' in result ? (
                      <p role="alert" className="mt-4 text-sm text-amber">
                        {result.error}
                      </p>
                    ) : (
                      (() => {
                        const { data } = result
                        const current = withHourlyFallback(data, now)
                        const today = data.daily[todayIndex(data.daily, now)]
                        return (
                          <>
                            <div className="tabular mt-3 flex items-center gap-3">
                              <WeatherIcon code={current.weatherCode} isDay={current.isDay ?? true} className="size-9" />
                              <p className="text-4xl font-light tracking-tight text-ink">{fmt.temp(current.temperature).text}</p>
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">{getCondition(current.weatherCode).description}</p>
                            <dl className="tabular mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                              <div>
                                <dt className="text-xs text-ink-mute">Feels like</dt>
                                <dd className="font-medium text-ink">{fmt.temp(current.apparentTemperature).text}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-ink-mute">High / low</dt>
                                <dd className="font-medium text-ink">
                                  {fmt.temp(today?.temperatureMax ?? null).text} / {fmt.temp(today?.temperatureMin ?? null).text}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-ink-mute">Wind</dt>
                                <dd className="font-medium text-ink">
                                  {current.windSpeed === null
                                    ? '—'
                                    : `${fmt.wind(current.windSpeed).text} ${cardinalDirection(current.windDirection)}`}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-ink-mute">Humidity</dt>
                                <dd className="font-medium text-ink">{fmt.percent(current.humidity).text}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-ink-mute">Precip. chance</dt>
                                <dd className="font-medium text-ink">{fmt.percent(current.precipitationProbability).text}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-ink-mute">Local time</dt>
                                <dd className="font-medium text-ink">
                                  {formatWeekday(now, data.timezone)} {formatTime(now, data.timezone, settings.timeFormat)}
                                </dd>
                              </div>
                            </dl>
                            {place.id !== location?.id && (
                              <button type="button" className="chip mt-4" onClick={() => selectLocation(place)}>
                                Open full forecast
                              </button>
                            )}
                          </>
                        )
                      })()
                    )}
                  </li>
                )
              })}
            </ul>

            {chartItems.length >= 2 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-medium text-ink-soft">Temperature, next 48 hours (your local time on the axis)</h3>
                <CompareChart items={chartItems} now={now} />
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  )
})

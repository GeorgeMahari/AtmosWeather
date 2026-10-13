import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ChartLine,
  Clock,
  CloudSun,
  Columns3,
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  RefreshCw,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLocations } from '../../app/LocationsContext'
import { useSettings } from '../../app/SettingsContext'
import type { GeolocationState } from '../../hooks/useGeolocation'
import type { WeatherState } from '../../hooks/useWeather'
import { formatRelative, formatTime, formatWeekday } from '../../utils/dateFormatting'
import { locationTitle } from '../../utils/weatherTransformers'
import { Segmented, cx } from '../common/primitives'
import { LocationSearch } from './LocationSearch'
import { SettingsMenu } from './SettingsMenu'

export const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'now', label: 'Now', icon: CloudSun },
  { id: 'hourly', label: 'Hourly', icon: Clock },
  { id: 'daily', label: 'Daily', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: ChartLine },
  { id: 'air', label: 'Air', icon: Wind },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'compare', label: 'Compare', icon: Columns3 },
]

/** Tracks which dashboard section is currently nearest the top of the viewport. */
function useActiveSection(enabled: boolean): string {
  const [active, setActive] = useState('now')
  useEffect(() => {
    if (!enabled) return
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        }
        const first = SECTIONS.find((s) => visible.has(s.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-25% 0px -60% 0px' },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [enabled])
  return active
}

interface HeaderProps {
  weather: WeatherState
  geolocation: GeolocationState
  now: number
}

export function Header({ weather, geolocation, now }: HeaderProps) {
  const { location, selectLocation, favorites, recents } = useLocations()
  const { settings, setUnit } = useSettings()
  const active = useActiveSection(weather.data !== null)
  const { data } = weather
  const busy = weather.isLoading || weather.isRefreshing

  const updatedLabel = data
    ? `Updated ${formatRelative(data.fetchedAt, now)}`
    : weather.isLoading
      ? 'Loading…'
      : 'No data yet'

  return (
    <>
      <header className="glass-strong sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-6">
          <a href="#now" className="flex flex-none items-center gap-2 rounded-lg" aria-label="Atmos — back to current weather">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan/90 to-indigo-500 text-night shadow-lg">
              <CloudSun aria-hidden="true" className="size-5" strokeWidth={2} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">Atmos</span>
          </a>

          {location && data && (
            <p className="hidden min-w-0 flex-col leading-tight xl:flex">
              <span className="truncate text-sm font-medium text-ink">{locationTitle(location)}</span>
              <span className="tabular truncate text-xs text-ink-mute">
                {formatWeekday(now, data.timezone)} {formatTime(now, data.timezone, settings.timeFormat)} local
              </span>
            </p>
          )}

          <div className="order-last flex w-full items-center gap-2 md:order-none md:ml-2 md:w-auto md:max-w-md md:flex-1">
            <LocationSearch className="min-w-0 flex-1" onSelect={selectLocation} favorites={favorites} recents={recents} />
            <button
              type="button"
              className="icon-btn"
              onClick={geolocation.locate}
              disabled={geolocation.status === 'locating'}
              aria-label="Use my current location"
              title="Use my current location"
            >
              {geolocation.status === 'locating' ? (
                <LoaderCircle aria-hidden="true" className="size-[1.125rem] animate-spin" />
              ) : (
                <LocateFixed aria-hidden="true" className="size-[1.125rem]" />
              )}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <p
              className={cx('tabular hidden text-right text-xs leading-tight sm:block', weather.error ? 'text-amber' : 'text-ink-mute')}
              aria-live="polite"
            >
              {updatedLabel}
              {weather.error && data && <span className="block">Refresh failed</span>}
            </p>
            <button
              type="button"
              className="icon-btn"
              onClick={weather.refresh}
              disabled={busy || !location}
              aria-label={busy ? 'Refreshing weather data' : `Refresh weather data. ${updatedLabel}`}
              title={updatedLabel}
            >
              <RefreshCw aria-hidden="true" className={cx('size-[1.125rem]', busy && 'animate-spin')} />
            </button>
            <Segmented
              label="Temperature unit"
              value={settings.units.temperature}
              onChange={(value) => setUnit('temperature', value)}
              options={[
                { value: 'c', label: '°C', ariaLabel: 'Celsius' },
                { value: 'f', label: '°F', ariaLabel: 'Fahrenheit' },
              ]}
            />
            <SettingsMenu />
          </div>
        </div>

        {/* Section navigation — tablet and desktop */}
        <nav aria-label="Dashboard sections" className="mx-auto hidden max-w-[92rem] px-3 pb-2 sm:px-6 md:block">
          <ul className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a href={`#${id}`} className="chip" aria-current={active === id ? 'true' : undefined}>
                  <Icon aria-hidden="true" className="size-3.5" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Section navigation — mobile bottom bar */}
      <nav
        aria-label="Dashboard sections"
        className="glass-strong fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-7">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? 'true' : undefined}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[0.625rem] font-medium',
                  active === id ? 'text-accent' : 'text-ink-mute',
                )}
              >
                <Icon aria-hidden="true" className="size-[1.125rem]" />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { LocateFixed, TriangleAlert, WifiOff, X } from 'lucide-react'
import { DashboardSkeleton } from '../components/common/LoadingSkeleton'
import { ErrorState } from '../components/common/primitives'
import { Header } from '../components/layout/Header'
import { WeatherBackground } from '../components/layout/WeatherBackground'
import { AirQuality } from '../components/weather/AirQuality'
import { CompareLocations } from '../components/weather/CompareLocations'
import { CurrentConditions } from '../components/weather/CurrentConditions'
import { DailyForecast } from '../components/weather/DailyForecast'
import { HourlyForecast } from '../components/weather/HourlyForecast'
import { WeatherCharts } from '../components/weather/WeatherCharts'
import { WeatherHero } from '../components/weather/WeatherHero'
import { WeatherMap } from '../components/weather/WeatherMap'
import { useGeolocation } from '../hooks/useGeolocation'
import { useNow, useOnline } from '../hooks/useNow'
import { useWeather } from '../hooks/useWeather'
import { FORECAST_TTL_MS } from '../services/weatherApi'
import { formatRelative } from '../utils/dateFormatting'
import { SCENES, selectScene } from '../utils/weatherConditions'
import { todayIndex } from '../utils/weatherTransformers'
import { LocationsProvider, useLocations } from './LocationsContext'
import { SettingsProvider, useSettings } from './SettingsContext'

function Banner({ tone, icon, children, action }: { tone: 'warn' | 'info'; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === 'warn' ? 'alert' : 'status'}
      className="glass mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm text-ink-soft"
    >
      <span className={tone === 'warn' ? 'text-amber' : 'text-accent'}>{icon}</span>
      <p className="min-w-[min(100%,16rem)] flex-1">{children}</p>
      {action}
    </div>
  )
}

function Dashboard() {
  const { location, selectLocation, isFirstVisit, dismissWelcome } = useLocations()
  const { settings, motionEnabled } = useSettings()
  const weather = useWeather(location)
  const geolocation = useGeolocation(selectLocation)
  const now = useNow()
  const online = useOnline()
  const { data } = weather

  const scene = useMemo(() => {
    if (!data) return SCENES.neutral
    const today = data.daily[todayIndex(data.daily, now)]
    return selectScene({
      weatherCode: data.current.weatherCode,
      isDay: data.current.isDay,
      temperature: data.current.temperature,
      now,
      sunrise: today?.sunrise ?? null,
      sunset: today?.sunset ?? null,
    })
  }, [data, now])

  const stale = data !== null && now - data.fetchedAt > FORECAST_TTL_MS * 2

  return (
    <MotionConfig reducedMotion={motionEnabled ? 'never' : 'always'}>
      <div data-scene={scene.key} data-motion={motionEnabled ? 'on' : 'off'} className="relative min-h-dvh overflow-x-clip">
        <WeatherBackground scene={scene} effects={motionEnabled ? settings.effects : settings.effects === 'off' ? 'off' : 'reduced'} />
        <a
          href="#main"
          className="glass-strong sr-only z-50 rounded-lg px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Header weather={weather} geolocation={geolocation} now={now} />

        <main id="main" className="mx-auto max-w-[92rem] px-3 pb-28 sm:px-6 md:pb-16">
          {!online && (
            <Banner tone="warn" icon={<WifiOff aria-hidden="true" className="size-4" />}>
              You are offline. {data ? 'Showing the last forecast this browser received — it will not update until you reconnect.' : 'Weather data cannot be loaded until you reconnect.'}
            </Banner>
          )}
          {online && data && (weather.error || stale) && (
            <Banner
              tone="warn"
              icon={<TriangleAlert aria-hidden="true" className="size-4" />}
              action={
                <button type="button" className="chip" onClick={weather.refresh} disabled={weather.isRefreshing}>
                  {weather.isRefreshing ? 'Retrying…' : 'Retry now'}
                </button>
              }
            >
              {weather.error ?? 'This forecast has not been refreshed recently.'} Showing data received{' '}
              {formatRelative(data.fetchedAt, now)}, which may be out of date.
            </Banner>
          )}
          {geolocation.error && (
            <Banner
              tone="warn"
              icon={<LocateFixed aria-hidden="true" className="size-4" />}
              action={
                <button type="button" className="icon-btn" onClick={geolocation.clearError} aria-label="Dismiss location message">
                  <X aria-hidden="true" className="size-4" />
                </button>
              }
            >
              {geolocation.error}
            </Banner>
          )}
          {isFirstVisit && location && !geolocation.error && (
            <Banner
              tone="info"
              icon={<LocateFixed aria-hidden="true" className="size-4" />}
              action={
                <span className="flex items-center gap-2">
                  {geolocation.supported && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        dismissWelcome()
                        geolocation.locate()
                      }}
                    >
                      Use my location
                    </button>
                  )}
                  <button type="button" className="icon-btn" onClick={dismissWelcome} aria-label="Dismiss welcome message">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </span>
              }
            >
              Welcome to Atmos. We picked <strong className="font-semibold text-ink">{location.name}</strong> from your time zone as a
              starting point — search for any place, or share your location for local weather. Location access is optional.
            </Banner>
          )}

          {!location || weather.isLoading ? (
            <DashboardSkeleton label={location ? `Loading weather for ${location.name}` : 'Finding a starting location'} />
          ) : !data ? (
            <div className="glass mt-10">
              <ErrorState
                title={`Could not load weather for ${location.name}`}
                message={weather.error ?? 'No data was returned for this location.'}
                onRetry={weather.refresh}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              <WeatherHero location={location} data={data} now={now} />
              <CurrentConditions data={data} now={now} />
              <HourlyForecast data={data} now={now} />
              <DailyForecast data={data} now={now} />
              <WeatherCharts data={data} now={now} />
              <AirQuality location={location} now={now} />
              <WeatherMap location={location} timezone={data.timezone} now={now} />
              <CompareLocations now={now} />
            </div>
          )}

          <footer className="mt-14 border-t border-line pt-5 text-xs leading-relaxed text-ink-mute">
            <p>
              Weather and air-quality data by{' '}
              <a className="underline underline-offset-2 hover:text-ink" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo.com
              </a>{' '}
              (CC BY 4.0), air quality from CAMS. Radar by{' '}
              <a className="underline underline-offset-2 hover:text-ink" href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">
                RainViewer
              </a>
              . Place names from GeoNames via Open-Meteo and BigDataCloud. Map © OpenStreetMap contributors.
            </p>
            <p className="mt-1.5">
              Values are numerical-model output, refreshed by this app roughly every 10 minutes while the tab is open. They are not
              official warnings — follow your national weather service in severe weather.
            </p>
          </footer>
        </main>
      </div>
    </MotionConfig>
  )
}

export function App() {
  return (
    <SettingsProvider>
      <LocationsProvider>
        <Dashboard />
      </LocationsProvider>
    </SettingsProvider>
  )
}

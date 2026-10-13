import { Suspense, lazy, memo, useCallback, useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useLocations } from '../../app/LocationsContext'
import { useSettings } from '../../app/SettingsContext'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { reverseGeocode } from '../../services/geocodingApi'
import { fetchRadarFrames } from '../../services/radarApi'
import type { GeoLocation } from '../../types/weatherTypes'
import { formatRelative, formatTime } from '../../utils/dateFormatting'
import { Section, Skeleton, cx } from '../common/primitives'

const MapView = lazy(() => import('./MapView'))

interface WeatherMapProps {
  location: GeoLocation
  timezone: string
  now: number
}

const loadFrames = (signal: AbortSignal) => fetchRadarFrames(signal)

export const WeatherMap = memo(function WeatherMap({ location, timezone, now }: WeatherMapProps) {
  const { selectLocation } = useLocations()
  const { settings } = useSettings()
  const [radarOn, setRadarOn] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)

  // The radar index is refreshed every 10 minutes (new frames arrive at that cadence).
  const refreshKey = `radar-${Math.floor(now / 600_000)}`
  const radar = useAsyncResource(radarOn ? refreshKey : null, loadFrames)
  const [frames, setFrames] = useState(radar.data ?? [])
  useEffect(() => {
    if (radar.data) setFrames(radar.data)
  }, [radar.data])

  const latest = frames.length - 1
  const index = frameIndex === null || frameIndex > latest ? latest : frameIndex
  const frame = frames[index]

  useEffect(() => {
    if (!playing || frames.length < 2) return
    const id = window.setInterval(() => {
      setFrameIndex((current) => {
        const at = current === null || current > frames.length - 1 ? frames.length - 1 : current
        return (at + 1) % frames.length
      })
    }, 700)
    return () => window.clearInterval(id)
  }, [playing, frames.length])

  const onPick = useCallback(
    async (latitude: number, longitude: number) => {
      setPicking(true)
      try {
        selectLocation(await reverseGeocode(latitude, longitude))
      } finally {
        setPicking(false)
      }
    },
    [selectLocation],
  )

  const radarAvailable = radarOn && frames.length > 0

  return (
    <Section
      id="map"
      title="Weather map"
      subtitle="Pan and zoom the map; click anywhere to load the forecast for that point. Hold Ctrl to zoom with the mouse wheel."
      action={
        <button type="button" className="chip" aria-pressed={radarOn} onClick={() => setRadarOn((v) => !v)}>
          Precipitation radar
        </button>
      }
    >
      <div className="glass overflow-hidden p-2 sm:p-3">
        <div className="relative overflow-hidden rounded-2xl">
          <Suspense fallback={<Skeleton className="h-[22rem] w-full sm:h-[28rem]" />}>
            <MapView
              latitude={location.latitude}
              longitude={location.longitude}
              locationName={location.name}
              radarTileUrl={radarAvailable && frame ? frame.tileUrl : null}
              onPick={onPick}
            />
          </Suspense>
          {picking && (
            <p role="status" className="glass-strong absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full px-3 py-1.5 text-xs text-ink">
              Looking up that place…
            </p>
          )}
        </div>

        <div className="px-2 pt-3 pb-1 sm:px-3">
          {!radarOn ? (
            <p className="text-sm text-ink-mute">Radar overlay is off — this is a plain geographic map.</p>
          ) : radar.error && frames.length === 0 ? (
            <p role="alert" className="text-sm text-amber">
              Radar imagery could not be loaded, so only the geographic map is shown.{' '}
              <button type="button" className="underline underline-offset-2" onClick={radar.reload}>
                Retry
              </button>
            </p>
          ) : frames.length === 0 ? (
            <p role="status" className="text-sm text-ink-mute">
              Loading radar frames…
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}
              >
                {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={latest}
                step={1}
                value={index}
                onChange={(event) => {
                  setPlaying(false)
                  setFrameIndex(Number(event.target.value))
                }}
                aria-label="Radar frame time"
                aria-valuetext={frame ? formatTime(frame.time, timezone, settings.timeFormat) : undefined}
                className="h-1.5 min-w-40 flex-1 cursor-pointer accent-[var(--accent)]"
              />
              {frame && (
                <p className="tabular text-sm text-ink-soft" aria-live="off">
                  <span className="font-medium text-ink">{formatTime(frame.time, timezone, settings.timeFormat)}</span>{' '}
                  <span className={cx('text-ink-mute', index === latest && 'text-accent')}>
                    {index === latest ? `latest · ${formatRelative(frame.time, now)}` : formatRelative(frame.time, now)}
                  </span>
                </p>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-mute">
            Radar shows observed precipitation echoes from the past two hours (RainViewer composite, about 10-minute steps). Coverage
            exists only where national radar networks share data; a blank area can mean either no rain or no radar. It is an
            observation layer, separate from the Open-Meteo forecast used elsewhere on this page.
          </p>
        </div>
      </div>
    </Section>
  )
})

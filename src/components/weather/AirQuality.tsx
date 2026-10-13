import { memo, useCallback, useState } from 'react'
import { Leaf } from 'lucide-react'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { fetchAirQuality } from '../../services/airQualityApi'
import type { GeoLocation, Maybe } from '../../types/weatherTypes'
import { formatTime } from '../../utils/dateFormatting'
import { formatNumber } from '../../utils/unitConversions'
import { EUROPEAN_AQI_BANDS, US_AQI_BANDS, aqiBand } from '../../utils/weatherConditions'
import type { AqiBand } from '../../utils/weatherConditions'
import { useSettings } from '../../app/SettingsContext'
import { AqiChart } from '../charts/lazy'
import { EmptyState, ErrorState, Section, Segmented, Skeleton, cx } from '../common/primitives'

interface AqiPanelProps {
  title: string
  authority: string
  value: Maybe<number>
  bands: AqiBand[]
  /** Upper end of the drawn scale. */
  scaleMax: number
  active: boolean
}

function AqiPanel({ title, authority, value, bands, scaleMax, active }: AqiPanelProps) {
  const band = aqiBand(value, bands)
  let start = 0
  const segments = bands.map((b) => {
    const end = Math.min(b.max, scaleMax)
    const segment = { ...b, from: start, to: end }
    start = end
    return segment
  })
  const marker = value === null ? null : Math.min(1, Math.max(0, value / scaleMax)) * 100

  return (
    <article className={cx('rounded-2xl border p-4 transition-colors', active ? 'border-accent/40 bg-white/5' : 'border-line')}>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="text-xs text-ink-mute">{authority}</p>
      <p className="tabular mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight text-ink">{value === null ? '—' : formatNumber(value)}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          {band && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: band.color }} />}
          {band ? band.label : 'Unavailable'}
        </span>
      </p>
      <div
        role="meter"
        aria-label={`${title} on a scale from 0 to ${scaleMax}`}
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        aria-valuenow={value === null ? undefined : Math.min(value, scaleMax)}
        aria-valuetext={value === null ? 'Unavailable' : `${formatNumber(value)}, ${band?.label}`}
        className="relative mt-4"
      >
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {segments.map((s) => (
            <span key={s.label} style={{ background: s.color, flexGrow: s.to - s.from, opacity: band?.label === s.label ? 1 : 0.4 }} />
          ))}
        </div>
        {marker !== null && (
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
            style={{ left: `${marker}%` }}
          />
        )}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{band ? band.advice : 'The provider did not return this index for the location.'}</p>
    </article>
  )
}

const POLLUTANTS = [
  { key: 'pm25', name: 'PM2.5', description: 'Fine particles' },
  { key: 'pm10', name: 'PM10', description: 'Coarse particles' },
  { key: 'nitrogenDioxide', name: 'NO₂', description: 'Nitrogen dioxide' },
  { key: 'ozone', name: 'O₃', description: 'Ozone' },
  { key: 'sulphurDioxide', name: 'SO₂', description: 'Sulphur dioxide' },
  { key: 'carbonMonoxide', name: 'CO', description: 'Carbon monoxide' },
] as const

interface AirQualityProps {
  location: GeoLocation
  now: number
}

export const AirQuality = memo(function AirQuality({ location, now }: AirQualityProps) {
  const { settings } = useSettings()
  const [scale, setScale] = useState<'eu' | 'us'>(() => (location.countryCode === 'US' ? 'us' : 'eu'))
  const load = useCallback(
    (signal: AbortSignal, force: boolean) => fetchAirQuality(location, signal, force),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.id],
  )
  const { data, isLoading, error, reload } = useAsyncResource(location.id, load)

  const hasAny = data !== null && (data.europeanAqi !== null || data.usAqi !== null || POLLUTANTS.some((p) => data[p.key] !== null))

  return (
    <Section
      id="air"
      title="Air quality"
      subtitle="Modelled concentrations from the Copernicus Atmosphere Monitoring Service via Open-Meteo — not a local sensor reading."
      action={
        <Segmented
          size="sm"
          label="Air quality index scale for the chart"
          value={scale}
          onChange={setScale}
          options={[
            { value: 'eu', label: 'European AQI' },
            { value: 'us', label: 'US AQI' },
          ]}
        />
      }
    >
      <div className="glass p-4 sm:p-5">
        {isLoading && !data ? (
          <div role="status" aria-label="Loading air quality" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : error && !data ? (
          <ErrorState compact title="Air quality is unavailable right now" message={error} onRetry={reload} />
        ) : !data || !hasAny ? (
          <EmptyState
            compact
            icon={<Leaf aria-hidden="true" className="size-7" />}
            title="No air-quality data for this location"
            message="The air-quality model does not cover this point. Weather data above is unaffected."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <AqiPanel
                title="European AQI"
                authority="European Environment Agency scale · 0–100+"
                value={data.europeanAqi}
                bands={EUROPEAN_AQI_BANDS}
                scaleMax={120}
                active={scale === 'eu'}
              />
              <AqiPanel
                title="US AQI"
                authority="US EPA scale · 0–500"
                value={data.usAqi}
                bands={US_AQI_BANDS}
                scaleMax={350}
                active={scale === 'us'}
              />
            </div>
            <p className="mt-3 text-xs text-ink-mute">
              The two indices use different pollutant averaging periods and breakpoints, so their numbers are not comparable with each
              other.
            </p>

            <h3 className="mt-6 mb-3 text-sm font-medium text-ink-soft">Pollutant concentrations</h3>
            <dl className="tabular grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {POLLUTANTS.map((p) => {
                const value = data[p.key]
                return (
                  <div key={p.key} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
                    <dt className="text-xs text-ink-mute">
                      <span className="font-semibold text-ink-soft">{p.name}</span> · {p.description}
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-ink">
                      {value === null ? '—' : formatNumber(value, value < 10 ? 1 : 0)}
                      {value !== null && <span className="ml-1 text-xs font-normal text-ink-mute">µg/m³</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>

            {data.pollen.length > 0 && (
              <>
                <h3 className="mt-6 mb-3 text-sm font-medium text-ink-soft">Pollen (grains/m³)</h3>
                <ul className="tabular flex flex-wrap gap-2">
                  {data.pollen.map((p) => (
                    <li key={p.key} className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-ink-soft">
                      {p.label} <span className="font-semibold text-ink">{formatNumber(p.value, 1)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {data.hourly.length > 2 && (
              <>
                <h3 className="mt-6 mb-3 text-sm font-medium text-ink-soft">
                  {scale === 'eu' ? 'European AQI' : 'US AQI'} — next {data.hourly.length} hours
                </h3>
                <AqiChart hours={data.hourly} scale={scale} timezone={data.timezone} now={now} />
              </>
            )}

            <p className="tabular mt-4 text-xs text-ink-mute">
              Model values for the hour starting {formatTime(data.time, data.timezone, settings.timeFormat)} local
              {error && ' · latest refresh failed, showing the previous result'}.
            </p>
          </>
        )}
      </div>
    </Section>
  )
})

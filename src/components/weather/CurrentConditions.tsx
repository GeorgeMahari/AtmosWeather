import { memo } from 'react'
import type { ReactNode } from 'react'
import {
  Cloud,
  CloudRain,
  Droplet,
  Droplets,
  Eye,
  Gauge,
  Mountain,
  Snowflake,
  Sun,
  SunMedium,
  Thermometer,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  Minus,
  Umbrella,
  Wind,
} from 'lucide-react'
import { useSettings } from '../../app/SettingsContext'
import type { WeatherData } from '../../types/weatherTypes'
import { formatHour } from '../../utils/dateFormatting'
import { cardinalDirection, convertPressure, convertTemperatureDelta, formatNumber } from '../../utils/unitConversions'
import {
  beaufort,
  cloudLabel,
  dewPointLabel,
  getCondition,
  humidityLabel,
  precipitationRateLabel,
  pressureTendencyLabel,
  uvAdvice,
  uvCategory,
  visibilityLabel,
} from '../../utils/weatherConditions'
import { currentHourIndex, pressureTendency, todayIndex, upcomingHours, withHourlyFallback } from '../../utils/weatherTransformers'
import { Meter, Section, Sparkline, cx } from '../common/primitives'
import { SunriseSunset } from './SunriseSunset'
import { WeatherIcon } from './WeatherIcon'
import { WindCompass } from './WindCompass'

interface MetricCardProps {
  label: string
  icon: ReactNode
  value?: ReactNode
  unit?: string
  /** Short contextual reading of the value. */
  note?: ReactNode
  children?: ReactNode
  className?: string
  /** Let the body fill and centre in the card (for the large visual cards). */
  fill?: boolean
}

export function WeatherMetricCard({ label, icon, value, unit, note, children, className, fill }: MetricCardProps) {
  return (
    <article className={cx('glass glass-hover flex min-w-0 flex-col p-4 sm:p-5', className)}>
      <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-mute uppercase">
        <span className="text-accent">{icon}</span>
        <span className="truncate">{label}</span>
      </h3>
      {value !== undefined && (
        <p className="tabular mt-3 flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {value}
          {unit && <span className="text-sm font-normal text-ink-mute sm:text-base">{unit}</span>}
        </p>
      )}
      {note && <p className="mt-1 text-sm text-ink-soft">{note}</p>}
      {children && <div className={fill ? 'flex flex-1 flex-col justify-center pt-4' : 'mt-auto pt-3'}>{children}</div>}
    </article>
  )
}

/** WHO UV colour bands, used as a scale legend (the value itself is labelled in text). */
const UV_TRACK =
  'linear-gradient(90deg, #4f9d69 0%, #4f9d69 22%, #d3a52b 27%, #d3a52b 47%, #d9772e 52%, #d9772e 66%, #c94a4a 70%, #c94a4a 88%, #8d5fc7 93%)'

const iconClass = 'size-4'

interface CurrentConditionsProps {
  data: WeatherData
  now: number
}

export const CurrentConditions = memo(function CurrentConditions({ data, now }: CurrentConditionsProps) {
  const { settings, fmt } = useSettings()
  const current = withHourlyFallback(data, now)
  const dayIdx = todayIndex(data.daily, now)
  const today = data.daily[dayIdx]
  const tomorrow = data.daily[dayIdx + 1]
  const hourIdx = currentHourIndex(data.hourly, now)
  const thisHour = data.hourly[hourIdx]
  const next24 = upcomingHours(data.hourly, now, 24)
  const condition = getCondition(current.weatherCode)

  // Feels-like vs. actual
  const feelsDelta =
    current.apparentTemperature !== null && current.temperature !== null
      ? convertTemperatureDelta(current.apparentTemperature - current.temperature, settings.units.temperature)
      : null
  const feelsNote =
    feelsDelta === null
      ? 'Comparison unavailable'
      : Math.abs(feelsDelta) < 1
        ? 'Similar to the actual temperature'
        : `${formatNumber(Math.abs(feelsDelta))}° ${feelsDelta < 0 ? 'cooler' : 'warmer'} than the air temperature`

  // Pressure
  const tendency = pressureTendency(data, now)
  const TendencyIcon = tendency === null ? Minus : tendency >= 0.4 ? TrendingUp : tendency <= -0.4 ? TrendingDown : Minus
  const pressure = fmt.pressure(current.pressureMsl)

  // Precipitation now. The provider reports the sum over the preceding interval.
  const intervalMin = current.intervalSeconds ? current.intervalSeconds / 60 : null
  const ratePerHour =
    current.precipitation !== null && current.intervalSeconds ? (current.precipitation * 3600) / current.intervalSeconds : null
  const precipNow = fmt.precip(current.precipitation)

  // Today's temperature range
  const tMin = today?.temperatureMin ?? null
  const tMax = today?.temperatureMax ?? null
  const rangeFraction =
    current.temperature !== null && tMin !== null && tMax !== null && tMax > tMin
      ? (current.temperature - tMin) / (tMax - tMin)
      : null

  const wind = fmt.wind(current.windSpeed)
  const gusts = fmt.wind(current.windGusts)
  const bft = beaufort(current.windSpeed)
  const uv = current.uvIndex
  const visibility = fmt.distance(current.visibility)
  const freezing = fmt.altitude(thisHour?.freezingLevel ?? null)
  const snowToday = today?.snowfallSum ?? null
  const peakPop = next24.reduce<{ time: number; value: number } | null>((best, h) => {
    if (h.precipitationProbability === null) return best
    return best === null || h.precipitationProbability > best.value ? { time: h.time, value: h.precipitationProbability } : best
  }, null)

  return (
    <Section
      id="conditions"
      title="Current conditions"
      subtitle="Every value comes from the forecast model for this location; a dash means the provider did not supply it."
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        <WeatherMetricCard
          label="Temperature"
          icon={<Thermometer className={iconClass} aria-hidden="true" />}
          value={fmt.tempFull(current.temperature, 1).value}
          unit={fmt.tempFull(null).unit}
          note={
            tMin !== null && tMax !== null ? (
              <>
                Today {fmt.temp(tMin).text} to {fmt.temp(tMax).text}
              </>
            ) : (
              "Today's range unavailable"
            )
          }
        >
          <Meter
            fraction={rangeFraction}
            fill={false}
            label="Current temperature within today's forecast range"
            track="linear-gradient(90deg, #7dd3fc, #fbbf24)"
          />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Feels like"
          icon={<ThermometerSun className={iconClass} aria-hidden="true" />}
          value={fmt.tempFull(current.apparentTemperature, 1).value}
          unit={fmt.tempFull(null).unit}
          note={feelsNote}
        >
          <Sparkline
            values={next24.map((h) => h.apparentTemperature)}
            markIndex={0}
            label="Feels-like temperature over the next 24 hours"
          />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Wind"
          icon={<Wind className={iconClass} aria-hidden="true" />}
          className="col-span-2 row-span-2"
          fill
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <WindCompass direction={current.windDirection} speedText={wind.text} className="size-36 flex-none sm:size-44" />
            <dl className="tabular grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-ink-mute">Speed</dt>
                <dd className="text-2xl font-semibold text-ink sm:text-3xl">
                  {wind.value} <span className="text-sm font-normal text-ink-mute sm:text-base">{wind.unit}</span>
                </dd>
                <dd className="text-sm text-ink-soft">{bft ? `${bft.label} · Beaufort ${bft.force}` : 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-mute">Gusts</dt>
                <dd className="font-medium text-ink">{gusts.text}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-mute">From</dt>
                <dd className="font-medium text-ink">
                  {current.windDirection === null
                    ? '—'
                    : `${cardinalDirection(current.windDirection)} · ${Math.round(current.windDirection)}°`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-mute">Today&rsquo;s max</dt>
                <dd className="font-medium text-ink">{fmt.wind(today?.windSpeedMax ?? null).text}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-mute">Max gust today</dt>
                <dd className="font-medium text-ink">{fmt.wind(today?.windGustsMax ?? null).text}</dd>
              </div>
            </dl>
          </div>
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Humidity"
          icon={<Droplets className={iconClass} aria-hidden="true" />}
          value={fmt.percent(current.humidity).value}
          unit="%"
          note={humidityLabel(current.humidity)}
        >
          <Meter fraction={current.humidity === null ? null : current.humidity / 100} label="Relative humidity" />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Dew point"
          icon={<Droplet className={iconClass} aria-hidden="true" />}
          value={fmt.tempFull(current.dewPoint, 1).value}
          unit={fmt.tempFull(null).unit}
          note={dewPointLabel(current.dewPoint)}
        />

        <WeatherMetricCard
          label="Pressure (sea level)"
          icon={<Gauge className={iconClass} aria-hidden="true" />}
          value={pressure.value}
          unit={pressure.unit}
          note={
            <span className="inline-flex items-center gap-1.5">
              <TendencyIcon aria-hidden="true" className="size-4 text-accent" />
              {pressureTendencyLabel(tendency)}
              {tendency !== null && (
                <span className="text-ink-mute">
                  ({tendency > 0 ? '+' : ''}
                  {formatNumber(convertPressure(tendency, settings.units.pressure), settings.units.pressure === 'inhg' ? 2 : 1)} in 3 h)
                </span>
              )}
            </span>
          }
        >
          <p className="tabular text-xs text-ink-mute">
            Surface: {fmt.pressure(current.surfacePressure).text}
            {data.elevation !== null && ` at ${fmt.altitude(data.elevation).text}`}
          </p>
          <Sparkline
            className="mt-2"
            values={next24.map((h) => h.pressureMsl)}
            markIndex={0}
            label="Sea-level pressure over the next 24 hours"
          />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="UV index"
          icon={<Sun className={iconClass} aria-hidden="true" />}
          value={fmt.plain(uv, 1).value}
          note={uvCategory(uv)}
        >
          <Meter fraction={uv === null ? null : uv / 12} label="UV index on the WHO scale from 0 to 11+" track={UV_TRACK} />
          <p className="mt-2 text-xs text-ink-mute">
            {uvAdvice(uv)} Today&rsquo;s peak: {fmt.plain(today?.uvIndexMax ?? null, 1).value}.
          </p>
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Sun & daylight"
          icon={<SunMedium className={iconClass} aria-hidden="true" />}
          className="col-span-2 row-span-2"
          fill
        >
          <SunriseSunset data={data} today={today} tomorrow={tomorrow} now={now} />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Visibility"
          icon={<Eye className={iconClass} aria-hidden="true" />}
          value={visibility.value}
          unit={visibility.unit}
          note={visibilityLabel(current.visibility)}
        >
          <Meter
            fraction={current.visibility === null ? null : current.visibility / 30_000}
            label="Visibility relative to 30 kilometres"
          />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Cloud cover"
          icon={<Cloud className={iconClass} aria-hidden="true" />}
          value={fmt.percent(current.cloudCover).value}
          unit="%"
          note={cloudLabel(current.cloudCover)}
        >
          <Meter fraction={current.cloudCover === null ? null : current.cloudCover / 100} label="Cloud cover" />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Precipitation now"
          icon={<CloudRain className={iconClass} aria-hidden="true" />}
          value={precipNow.value}
          unit={precipNow.unit}
          note={
            <>
              {precipitationRateLabel(ratePerHour)}
              {intervalMin !== null && <span className="text-ink-mute"> · last {Math.round(intervalMin)} min</span>}
            </>
          }
        >
          <dl className="tabular grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-ink-mute">Rate</dt>
              <dd className="text-sm font-medium text-ink">
                {ratePerHour === null ? '—' : `${fmt.precip(ratePerHour).text}/h`}
              </dd>
            </div>
            <div>
              <dt className="text-ink-mute">Today total</dt>
              <dd className="text-sm font-medium text-ink">{fmt.precip(today?.precipitationSum ?? null).text}</dd>
            </div>
          </dl>
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Precipitation chance"
          icon={<Umbrella className={iconClass} aria-hidden="true" />}
          value={fmt.percent(current.precipitationProbability).value}
          unit="%"
          note={
            peakPop === null
              ? 'Hourly probabilities unavailable'
              : peakPop.value < 10
                ? 'Staying low for the next 24 h'
                : `Peaks at ${Math.round(peakPop.value)}% around ${formatHour(peakPop.time, data.timezone, settings.timeFormat)}`
          }
        >
          <Meter
            fraction={current.precipitationProbability === null ? null : current.precipitationProbability / 100}
            label="Precipitation probability this hour"
          />
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Rain & snow today"
          icon={<Snowflake className={iconClass} aria-hidden="true" />}
        >
          <dl className="tabular grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-mute">Rain</dt>
              <dd className="text-xl font-semibold text-ink">{fmt.precip(today?.rainSum ?? null).text}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Snowfall</dt>
              <dd className="text-xl font-semibold text-ink">{fmt.snow(snowToday).text}</dd>
            </div>
            <div className="col-span-2 text-xs text-ink-mute">
              {today?.precipitationHours != null
                ? `${formatNumber(today.precipitationHours)} h with precipitation forecast today`
                : 'Hours with precipitation unavailable'}
            </div>
          </dl>
        </WeatherMetricCard>

        <WeatherMetricCard
          label="Freezing level"
          icon={<Mountain className={iconClass} aria-hidden="true" />}
          value={freezing.value}
          unit={freezing.unit}
          note="Altitude of the 0 °C isotherm this hour"
        />

        <WeatherMetricCard
          label="Sky condition"
          icon={<WeatherIcon code={current.weatherCode} isDay={current.isDay ?? true} className={iconClass} />}
          value={<span className="text-xl sm:text-2xl">{condition.description}</span>}
          note={
            <span className="text-ink-mute">
              WMO weather code {current.weatherCode ?? '—'} · {current.isDay === null ? 'day/night unknown' : current.isDay ? 'daytime' : 'night-time'}
            </span>
          }
        />
      </div>
    </Section>
  )
})

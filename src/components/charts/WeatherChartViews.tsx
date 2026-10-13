import { useMemo } from 'react'
import { useSettings } from '../../app/SettingsContext'
import type { AirQualityHour, DailyPoint, HourlyPoint, Maybe, TimeFormat } from '../../types/weatherTypes'
import { formatHour, formatShortDate, formatWeekday, formatWeekdayHour, localHour } from '../../utils/dateFormatting'
import {
  UNIT_LABELS,
  cardinalDirection,
  convertPrecipitation,
  convertPressure,
  convertTemperature,
  convertWind,
  formatNumber,
} from '../../utils/unitConversions'
import { getCondition } from '../../utils/weatherConditions'
import { SERIES_COLORS, TimeChart, timeTicks } from './TimeChart'
import type { ChartRow, ChartSeries } from './TimeChart'

/**
 * Every Recharts-based view lives in this module so the charting library is
 * loaded as one lazy chunk (see ./lazy.ts).
 */

const [SKY, AMBER, VIOLET, GREEN] = SERIES_COLORS

const map = (value: Maybe<number>, fn: (v: number) => number): Maybe<number> => (value === null ? null : fn(value))

function useHourAxis(rows: ChartRow[], timeZone: string, timeFormat: TimeFormat) {
  return useMemo(() => {
    const n = rows.length
    const step = n <= 26 ? 3 : n <= 50 ? 6 : n <= 74 ? 12 : 24
    return {
      ticks: timeTicks(rows, timeZone, step),
      tickFormat: (t: number) =>
        n > 26 && Math.floor(localHour(t, timeZone)) === 0 ? formatWeekday(t, timeZone) : formatHour(t, timeZone, timeFormat),
      tooltipTitle: (t: number) => formatWeekdayHour(t, timeZone, timeFormat),
    }
  }, [rows, timeZone, timeFormat])
}

// ------------------------------------------------------------ Hourly (24 h)

interface HourlyTempChartProps {
  hours: HourlyPoint[]
  timezone: string
  now: number
  selected: number | null
  onHover: (t: number | null) => void
  onSelect: (t: number) => void
}

export function HourlyTempChart({ hours, timezone, now, selected, onHover, onSelect }: HourlyTempChartProps) {
  const { settings, fmt } = useSettings()
  const unit = settings.units.temperature
  const rows = useMemo<ChartRow[]>(
    () =>
      hours.map((h) => ({
        t: h.time,
        temp: map(h.temperature, (v) => convertTemperature(v, unit)),
        feels: map(h.apparentTemperature, (v) => convertTemperature(v, unit)),
      })),
    [hours, unit],
  )
  const byTime = useMemo(() => new Map(hours.map((h) => [h.time, h])), [hours])
  const axis = useHourAxis(rows, timezone, settings.timeFormat)
  const degrees = (v: number) => `${formatNumber(v)}°`
  const series = useMemo<ChartSeries[]>(
    () => [
      { key: 'temp', name: 'Temperature', color: SKY, kind: 'area', format: (v) => `${formatNumber(v, 1)}${UNIT_LABELS.temperature[unit]}` },
      { key: 'feels', name: 'Feels like', color: AMBER, kind: 'line', dashed: true, format: (v) => `${formatNumber(v, 1)}${UNIT_LABELS.temperature[unit]}` },
    ],
    [unit],
  )

  const temps = rows.flatMap((r) => (r.temp == null ? [] : [r.temp]))
  const range = temps.length ? `from ${degrees(Math.min(...temps))} to ${degrees(Math.max(...temps))}` : 'unavailable'

  return (
    <TimeChart
      rows={rows}
      series={series}
      {...axis}
      yFormat={degrees}
      height={240}
      now={now}
      selected={selected}
      onHover={onHover}
      onSelect={onSelect}
      ariaLabel={`Line chart of temperature and feels-like temperature for the next ${hours.length} hours, ranging ${range} ${UNIT_LABELS.temperature[unit]}. The hourly list below contains the same data.`}
      tooltipExtra={(t) => {
        const h = byTime.get(t)
        if (!h) return null
        return (
          <p className="mt-1.5 border-t border-line pt-1.5 text-ink-mute">
            {getCondition(h.weatherCode).description} · {fmt.percent(h.precipitationProbability).text} precip. ·{' '}
            {fmt.wind(h.windSpeed).text} {cardinalDirection(h.windDirection)}
          </p>
        )
      }}
    />
  )
}

// ------------------------------------------------------- Daily min / max

export function DailyRangeChart({ daily, timezone }: { daily: DailyPoint[]; timezone: string }) {
  const { settings } = useSettings()
  const unit = settings.units.temperature
  const rows = useMemo<ChartRow[]>(
    () =>
      daily.map((d) => ({
        t: d.time,
        max: map(d.temperatureMax, (v) => convertTemperature(v, unit)),
        min: map(d.temperatureMin, (v) => convertTemperature(v, unit)),
      })),
    [daily, unit],
  )
  const format = (v: number) => `${formatNumber(v, 1)}${UNIT_LABELS.temperature[unit]}`
  const series = useMemo<ChartSeries[]>(
    () => [
      { key: 'max', name: 'Daily high', color: AMBER, kind: 'line', format },
      { key: 'min', name: 'Daily low', color: SKY, kind: 'line', format },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unit],
  )
  return (
    <TimeChart
      rows={rows}
      series={series}
      ticks={rows.map((r) => r.t)}
      tickFormat={(t) => formatWeekday(t, timezone)}
      tooltipTitle={(t) => `${formatWeekday(t, timezone, 'long')}, ${formatShortDate(t, timezone)}`}
      yFormat={(v) => `${formatNumber(v)}°`}
      height={220}
      ariaLabel={`Line chart comparing forecast daily high and low temperatures over ${daily.length} days. The daily list contains the same values.`}
    />
  )
}

// ---------------------------------------------------------------- Analytics

export type AnalyticsMetric = 'temperature' | 'humidity' | 'pressure' | 'wind' | 'precipitation' | 'clouds' | 'uv' | 'sun'

interface AnalyticsChartProps {
  metric: AnalyticsMetric
  hours: HourlyPoint[]
  daily: DailyPoint[]
  timezone: string
  now: number
}

interface Panel {
  title?: string
  series: ChartSeries[]
  yFormat: (v: number) => string
  yDomain?: React.ComponentProps<typeof TimeChart>['yDomain']
  height?: number
}

export function AnalyticsChart({ metric, hours, daily, timezone, now }: AnalyticsChartProps) {
  const { settings } = useSettings()
  const { units, timeFormat } = settings

  const hourRows = useMemo<ChartRow[]>(() => {
    let total = 0
    return hours.map((h) => {
      const precip = map(h.precipitation, (v) => convertPrecipitation(v, units.precipitation))
      if (precip !== null) total += precip
      return {
        t: h.time,
        temp: map(h.temperature, (v) => convertTemperature(v, units.temperature)),
        feels: map(h.apparentTemperature, (v) => convertTemperature(v, units.temperature)),
        dew: map(h.dewPoint, (v) => convertTemperature(v, units.temperature)),
        humidity: h.humidity,
        pressure: map(h.pressureMsl, (v) => convertPressure(v, units.pressure)),
        wind: map(h.windSpeed, (v) => convertWind(v, units.wind)),
        gusts: map(h.windGusts, (v) => convertWind(v, units.wind)),
        pop: h.precipitationProbability,
        precip,
        // Running total is only meaningful while every hour so far is known.
        accumulated: precip === null ? null : total,
        clouds: h.cloudCover,
        uv: h.uvIndex,
      }
    })
  }, [hours, units])

  const dayRows = useMemo<ChartRow[]>(
    () =>
      daily.map((d) => ({
        t: d.time,
        daylight: map(d.daylightDuration, (v) => v / 3600),
        sunshine: map(d.sunshineDuration, (v) => v / 3600),
      })),
    [daily],
  )

  const hourAxis = useHourAxis(hourRows, timezone, timeFormat)

  const tUnit = UNIT_LABELS.temperature[units.temperature]
  const wUnit = UNIT_LABELS.wind[units.wind]
  const pUnit = UNIT_LABELS.precipitation[units.precipitation]
  const prUnit = UNIT_LABELS.pressure[units.pressure]
  const pDigits = units.precipitation === 'in' ? 2 : 1
  const prDigits = units.pressure === 'inhg' ? 2 : 0
  const wDigits = units.wind === 'ms' ? 1 : 0
  const percent = (v: number) => `${formatNumber(v)}%`
  const temp = (v: number) => `${formatNumber(v, 1)}${tUnit}`

  const panels: Panel[] = (() => {
    switch (metric) {
      case 'temperature':
        return [
          {
            series: [
              { key: 'temp', name: 'Temperature', color: SKY, kind: 'area', format: temp },
              { key: 'feels', name: 'Feels like', color: AMBER, kind: 'line', dashed: true, format: temp },
              { key: 'dew', name: 'Dew point', color: GREEN, kind: 'line', format: temp },
            ],
            yFormat: (v) => `${formatNumber(v)}°`,
          },
        ]
      case 'humidity':
        return [
          {
            series: [{ key: 'humidity', name: 'Relative humidity', color: SKY, kind: 'area', format: percent }],
            yFormat: percent,
            yDomain: [0, 100],
          },
        ]
      case 'pressure': {
        const pad = units.pressure === 'inhg' ? 0.05 : 2
        return [
          {
            series: [
              {
                key: 'pressure',
                name: 'Sea-level pressure',
                color: VIOLET,
                kind: 'line',
                format: (v) => `${formatNumber(v, prDigits, prDigits)} ${prUnit}`,
              },
            ],
            yFormat: (v) => formatNumber(v, prDigits, prDigits),
            yDomain: [(min: number) => min - pad, (max: number) => max + pad],
          },
        ]
      }
      case 'wind':
        return [
          {
            series: [
              { key: 'wind', name: 'Wind speed', color: SKY, kind: 'area', format: (v) => `${formatNumber(v, wDigits)} ${wUnit}` },
              { key: 'gusts', name: 'Gusts', color: AMBER, kind: 'line', dashed: true, format: (v) => `${formatNumber(v, wDigits)} ${wUnit}` },
            ],
            yFormat: (v) => formatNumber(v, wDigits),
            yDomain: [0, 'auto'],
          },
        ]
      case 'precipitation':
        return [
          {
            title: 'Probability of precipitation',
            series: [{ key: 'pop', name: 'Probability', color: SKY, kind: 'area', format: percent }],
            yFormat: percent,
            yDomain: [0, 100],
            height: 170,
          },
          {
            title: `Hourly amount (${pUnit})`,
            series: [{ key: 'precip', name: 'Amount', color: SKY, kind: 'bar', format: (v) => `${formatNumber(v, pDigits)} ${pUnit}` }],
            yFormat: (v) => formatNumber(v, pDigits),
            yDomain: [0, (max: number) => Math.max(max, units.precipitation === 'in' ? 0.04 : 1)],
            height: 170,
          },
          {
            title: `Accumulation over the period (${pUnit})`,
            series: [{ key: 'accumulated', name: 'Running total', color: VIOLET, kind: 'area', format: (v) => `${formatNumber(v, pDigits)} ${pUnit}` }],
            yFormat: (v) => formatNumber(v, pDigits),
            yDomain: [0, (max: number) => Math.max(max, units.precipitation === 'in' ? 0.04 : 1)],
            height: 170,
          },
        ]
      case 'clouds':
        return [
          {
            series: [{ key: 'clouds', name: 'Cloud cover', color: SKY, kind: 'area', format: percent }],
            yFormat: percent,
            yDomain: [0, 100],
          },
        ]
      case 'uv':
        return [
          {
            series: [{ key: 'uv', name: 'UV index', color: AMBER, kind: 'area', format: (v) => formatNumber(v, 1) }],
            yFormat: (v) => formatNumber(v, 1),
            yDomain: [0, (max: number) => Math.max(3, Math.ceil(max))],
          },
        ]
      case 'sun':
        return []
    }
  })()

  if (metric === 'sun') {
    const hoursFmt = (v: number) => `${formatNumber(v, 1)} h`
    return (
      <TimeChart
        rows={dayRows}
        series={[
          { key: 'sunshine', name: 'Forecast sunshine', color: AMBER, kind: 'bar', format: hoursFmt },
          { key: 'daylight', name: 'Daylight (sunrise to sunset)', color: SKY, kind: 'line', format: hoursFmt },
        ]}
        ticks={dayRows.map((r) => r.t)}
        tickFormat={(t) => formatWeekday(t, timezone)}
        tooltipTitle={(t) => `${formatWeekday(t, timezone, 'long')}, ${formatShortDate(t, timezone)}`}
        yFormat={(v) => `${formatNumber(v)} h`}
        yDomain={[0, (max: number) => Math.min(24, Math.ceil(max + 1))]}
        ariaLabel={`Chart of forecast sunshine hours and daylight length for ${daily.length} days. The table below lists sunrise and sunset times.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {panels.map((panel) => (
        <div key={panel.series.map((s) => s.key).join('-')}>
          {panel.title && <p className="mb-1 text-sm font-medium text-ink-soft">{panel.title}</p>}
          <TimeChart
            rows={hourRows}
            series={panel.series}
            {...hourAxis}
            yFormat={panel.yFormat}
            yDomain={panel.yDomain}
            height={panel.height ?? 300}
            now={now}
            ariaLabel={`${panel.title ?? panel.series.map((s) => s.name).join(', ')} over the next ${hours.length} hours.`}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------- Air quality

interface AqiChartProps {
  hours: AirQualityHour[]
  scale: 'eu' | 'us'
  timezone: string
  now: number
}

export function AqiChart({ hours, scale, timezone, now }: AqiChartProps) {
  const { settings } = useSettings()
  const rows = useMemo<ChartRow[]>(
    () => hours.map((h) => ({ t: h.time, aqi: scale === 'eu' ? h.europeanAqi : h.usAqi })),
    [hours, scale],
  )
  const axis = useHourAxis(rows, timezone, settings.timeFormat)
  const name = scale === 'eu' ? 'European AQI' : 'US AQI'
  return (
    <TimeChart
      rows={rows}
      series={[{ key: 'aqi', name, color: GREEN, kind: 'area', format: (v) => formatNumber(v) }]}
      {...axis}
      yFormat={(v) => formatNumber(v)}
      yDomain={[0, (max: number) => Math.max(scale === 'eu' ? 40 : 60, Math.ceil(max / 10) * 10)]}
      height={200}
      now={now}
      ariaLabel={`${name} forecast for the next ${hours.length} hours.`}
    />
  )
}

// --------------------------------------------------------------- Compare

export interface CompareSeriesInput {
  id: string
  name: string
  /** Fixed palette slot so a place keeps its colour when others are removed. */
  slot: number
  hours: HourlyPoint[]
}

export function CompareChart({ items, now }: { items: CompareSeriesInput[]; now: number }) {
  const { settings } = useSettings()
  const unit = settings.units.temperature
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const rows = useMemo<ChartRow[]>(() => {
    const merged = new Map<number, ChartRow>()
    for (const item of items) {
      for (const h of item.hours) {
        const row = merged.get(h.time) ?? { t: h.time }
        row[`s${item.slot}`] = map(h.temperature, (v) => convertTemperature(v, unit))
        merged.set(h.time, row)
      }
    }
    return [...merged.values()].sort((a, b) => a.t - b.t)
  }, [items, unit])

  const series = items.map<ChartSeries>((item) => ({
    key: `s${item.slot}`,
    name: item.name,
    color: SERIES_COLORS[item.slot % SERIES_COLORS.length]!,
    kind: 'line',
    format: (v) => `${formatNumber(v, 1)}${UNIT_LABELS.temperature[unit]}`,
  }))
  const axis = useHourAxis(rows, viewerZone, settings.timeFormat)

  return (
    <TimeChart
      rows={rows}
      series={series}
      {...axis}
      yFormat={(v) => `${formatNumber(v)}°`}
      height={260}
      now={now}
      ariaLabel={`Temperature over the next 48 hours for ${items.map((i) => i.name).join(', ')}. Times are shown in your own time zone.`}
    />
  )
}

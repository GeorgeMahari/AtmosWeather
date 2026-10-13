import { memo, useMemo, useState } from 'react'
import { useSettings } from '../../app/SettingsContext'
import type { WeatherData } from '../../types/weatherTypes'
import { formatShortDate, formatTime, formatWeekday } from '../../utils/dateFormatting'
import { formatDuration, formatNumber } from '../../utils/unitConversions'
import { todayIndex, upcomingHours } from '../../utils/weatherTransformers'
import { AnalyticsChart } from '../charts/lazy'
import type { AnalyticsMetric } from '../charts/WeatherChartViews'
import { Section, Segmented } from '../common/primitives'

const METRICS: { value: AnalyticsMetric; label: string; description: string }[] = [
  { value: 'temperature', label: 'Temperature', description: 'Air temperature against feels-like temperature and dew point.' },
  { value: 'humidity', label: 'Humidity', description: 'Relative humidity at 2 m above ground.' },
  { value: 'pressure', label: 'Pressure', description: 'Atmospheric pressure reduced to mean sea level.' },
  { value: 'wind', label: 'Wind', description: 'Sustained wind speed at 10 m and the strongest gusts each hour.' },
  { value: 'precipitation', label: 'Precipitation', description: 'Chance, hourly amount and running total — three charts because the scales differ.' },
  { value: 'clouds', label: 'Clouds', description: 'Total cloud cover as a share of the sky.' },
  { value: 'uv', label: 'UV', description: 'UV index progression; it is zero at night.' },
  { value: 'sun', label: 'Sun', description: 'Day length and forecast sunshine duration per day.' },
]

const RANGES = [
  { value: '24', label: '24 h' },
  { value: '48', label: '48 h' },
  { value: '72', label: '3 days' },
  { value: 'all', label: 'All' },
] as const
type Range = (typeof RANGES)[number]['value']

const HOUR = 3_600_000

interface WeatherChartsProps {
  data: WeatherData
  now: number
}

export const WeatherCharts = memo(function WeatherCharts({ data, now }: WeatherChartsProps) {
  const { settings } = useSettings()
  const [metric, setMetric] = useState<AnalyticsMetric>('temperature')
  const [range, setRange] = useState<Range>('48')

  const hourBucket = Math.floor(now / HOUR)
  const hours = useMemo(
    () => upcomingHours(data.hourly, hourBucket * HOUR, range === 'all' ? data.hourly.length : Number(range)),
    [data.hourly, hourBucket, range],
  )
  const days = useMemo(() => data.daily.slice(Math.max(0, todayIndex(data.daily, hourBucket * HOUR))), [data.daily, hourBucket])
  const meta = METRICS.find((m) => m.value === metric)!
  const time = (ms: number | null) => (ms === null ? '—' : formatTime(ms, data.timezone, settings.timeFormat))

  return (
    <Section id="analytics" title="Weather analytics" subtitle={meta.description}>
      <div className="glass p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
            <Segmented label="Chart metric" value={metric} onChange={setMetric} options={METRICS} />
          </div>
          {metric !== 'sun' && <Segmented size="sm" label="Time range" value={range} onChange={setRange} options={RANGES} />}
        </div>

        <AnalyticsChart metric={metric} hours={hours} daily={days} timezone={data.timezone} now={now} />

        {metric === 'sun' && (
          <div className="thin-scrollbar mt-5 overflow-x-auto">
            <table className="tabular w-full min-w-[30rem] text-left text-sm">
              <caption className="sr-only">Sunrise, sunset, daylight and sunshine duration per day</caption>
              <thead className="text-xs text-ink-mute">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Day</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sunrise</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sunset</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Daylight</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sunshine</th>
                  <th scope="col" className="py-2 font-medium">UV max</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.time} className="border-t border-line text-ink-soft">
                    <th scope="row" className="py-2 pr-4 font-medium text-ink">
                      {formatWeekday(day.time, data.timezone)} {formatShortDate(day.time, data.timezone)}
                    </th>
                    <td className="py-2 pr-4">{time(day.sunrise)}</td>
                    <td className="py-2 pr-4">{time(day.sunset)}</td>
                    <td className="py-2 pr-4">{formatDuration(day.daylightDuration)}</td>
                    <td className="py-2 pr-4">{formatDuration(day.sunshineDuration)}</td>
                    <td className="py-2">{day.uvIndexMax === null ? '—' : formatNumber(day.uvIndexMax, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  )
})

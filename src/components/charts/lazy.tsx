import { Suspense, lazy } from 'react'
import type { ComponentProps, ReactNode } from 'react'

/** Recharts is split into its own chunk and fetched after the dashboard shell renders. */
const load = () => import('./WeatherChartViews')

const HourlyTempChartImpl = lazy(() => load().then((m) => ({ default: m.HourlyTempChart })))
const DailyRangeChartImpl = lazy(() => load().then((m) => ({ default: m.DailyRangeChart })))
const AnalyticsChartImpl = lazy(() => load().then((m) => ({ default: m.AnalyticsChart })))
const AqiChartImpl = lazy(() => load().then((m) => ({ default: m.AqiChart })))
const CompareChartImpl = lazy(() => load().then((m) => ({ default: m.CompareChart })))

function ChartBoundary({ height, children }: { height: number; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading chart">
          <div aria-hidden="true" className="skeleton w-full" style={{ height }} />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const HourlyTempChart = (props: ComponentProps<typeof HourlyTempChartImpl>) => (
  <ChartBoundary height={240}>
    <HourlyTempChartImpl {...props} />
  </ChartBoundary>
)
export const DailyRangeChart = (props: ComponentProps<typeof DailyRangeChartImpl>) => (
  <ChartBoundary height={220}>
    <DailyRangeChartImpl {...props} />
  </ChartBoundary>
)
export const AnalyticsChart = (props: ComponentProps<typeof AnalyticsChartImpl>) => (
  <ChartBoundary height={300}>
    <AnalyticsChartImpl {...props} />
  </ChartBoundary>
)
export const AqiChart = (props: ComponentProps<typeof AqiChartImpl>) => (
  <ChartBoundary height={200}>
    <AqiChartImpl {...props} />
  </ChartBoundary>
)
export const CompareChart = (props: ComponentProps<typeof CompareChartImpl>) => (
  <ChartBoundary height={260}>
    <CompareChartImpl {...props} />
  </ChartBoundary>
)

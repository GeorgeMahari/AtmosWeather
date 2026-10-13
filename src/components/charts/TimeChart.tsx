import { memo, useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSettings } from '../../app/SettingsContext'
import { localHour } from '../../utils/dateFormatting'
import { SERIES_COLORS } from './palette'

export { SERIES_COLORS }

export const CHART_INK = { tick: '#98a8c4', grid: 'rgba(255,255,255,0.07)', cursor: 'rgba(255,255,255,0.35)' }

export interface ChartSeries {
  key: string
  name: string
  color: string
  kind: 'line' | 'area' | 'bar'
  dashed?: boolean
  format: (value: number) => string
}

export interface ChartRow {
  t: number
  [key: string]: number | null
}

/** Row timestamps that fall on a local-hour multiple of `stepHours`. */
export function timeTicks(rows: ChartRow[], timeZone: string, stepHours: number): number[] {
  return rows.filter((row) => Math.floor(localHour(row.t, timeZone)) % stepHours === 0).map((row) => row.t)
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            {s.kind === 'bar' ? (
              <rect x="5" y="0" width="8" height="8" rx="2" fill={s.color} />
            ) : (
              <line x1="1" y1="4" x2="17" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dashed ? '4 3' : undefined} />
            )}
          </svg>
          {s.name}
          {s.dashed && <span className="sr-only"> (dashed line)</span>}
        </li>
      ))}
    </ul>
  )
}

export function ChartTooltip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-strong tabular min-w-36 rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-ink">{title}</p>
      {children}
    </div>
  )
}

export function TooltipRow({ series, value }: { series: Pick<ChartSeries, 'name' | 'color' | 'dashed' | 'kind'>; value: string }) {
  return (
    <p className="flex items-center justify-between gap-4 py-0.5 text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-3 rounded-full"
          style={
            series.dashed
              ? { backgroundImage: `linear-gradient(90deg, ${series.color} 60%, transparent 60%)`, backgroundSize: '6px 2px' }
              : { background: series.color, height: series.kind === 'bar' ? 8 : 2, width: series.kind === 'bar' ? 8 : 12, borderRadius: 2 }
          }
        />
        {series.name}
      </span>
      <span className="font-medium text-ink">{value}</span>
    </p>
  )
}

type DomainBound = number | 'auto' | 'dataMin' | 'dataMax' | ((value: number) => number)

interface TimeChartProps {
  rows: ChartRow[]
  series: ChartSeries[]
  ticks: number[]
  tickFormat: (t: number) => string
  tooltipTitle: (t: number) => string
  /** Extra lines under the series values in the tooltip. */
  tooltipExtra?: (t: number) => ReactNode
  yFormat: (value: number) => string
  yDomain?: [DomainBound, DomainBound]
  height?: number
  now?: number
  selected?: number | null
  onHover?: (t: number | null) => void
  onSelect?: (t: number) => void
  ariaLabel: string
}

export const TimeChart = memo(function TimeChart({
  rows,
  series,
  ticks,
  tickFormat,
  tooltipTitle,
  tooltipExtra,
  yFormat,
  yDomain = ['auto', 'auto'],
  height = 260,
  now,
  selected,
  onHover,
  onSelect,
  ariaLabel,
}: TimeChartProps) {
  const { motionEnabled } = useSettings()
  const gradientId = useId().replace(/:/g, '')
  const byTime = useMemo(() => new Map(rows.map((row) => [row.t, row])), [rows])
  const hasBars = series.some((s) => s.kind === 'bar')
  const barSize = rows.length <= 24 ? 10 : rows.length <= 48 ? 6 : rows.length <= 96 ? 3 : 2
  const first = rows[0]?.t
  const last = rows[rows.length - 1]?.t
  const showNow = now !== undefined && first !== undefined && last !== undefined && now >= first && now <= last

  const labelToTime = (label: unknown): number | null => {
    const t = Number(label)
    return Number.isFinite(t) && byTime.has(t) ? t : null
  }

  return (
    <div role="img" aria-label={ariaLabel}>
      <ChartLegend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={rows}
          margin={{ top: 14, right: 12, bottom: 0, left: 0 }}
          onMouseMove={onHover ? (state) => onHover(labelToTime(state.activeLabel)) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
          onClick={
            onSelect
              ? (state) => {
                  const t = labelToTime(state.activeLabel)
                  if (t !== null) onSelect(t)
                }
              : undefined
          }
        >
          <defs>
            {series
              .filter((s) => s.kind === 'area')
              .map((s) => (
                <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={tickFormat}
            tick={{ fill: CHART_INK.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={14}
            padding={hasBars ? { left: 10, right: 10 } : undefined}
          />
          <YAxis
            width={46}
            domain={yDomain}
            tickFormatter={yFormat}
            tick={{ fill: CHART_INK.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: CHART_INK.cursor, strokeWidth: 1 }}
            content={({ active, label }) => {
              const t = active ? labelToTime(label) : null
              const row = t === null ? undefined : byTime.get(t)
              if (t === null || !row) return null
              return (
                <ChartTooltip title={tooltipTitle(t)}>
                  {series.map((s) => {
                    const value = row[s.key]
                    return <TooltipRow key={s.key} series={s} value={value == null ? '—' : s.format(value)} />
                  })}
                  {tooltipExtra?.(t)}
                </ChartTooltip>
              )
            }}
          />
          {series.map((s) => {
            const common = {
              dataKey: s.key,
              name: s.name,
              isAnimationActive: motionEnabled,
              animationDuration: 500,
            }
            if (s.kind === 'bar') {
              return <Bar key={s.key} {...common} fill={s.color} barSize={barSize} radius={[3, 3, 0, 0]} />
            }
            const lineProps = {
              type: 'monotone' as const,
              stroke: s.color,
              strokeWidth: 2,
              strokeDasharray: s.dashed ? '5 4' : undefined,
              dot: false,
              activeDot: { r: 4, stroke: '#0c1524', strokeWidth: 2 },
              connectNulls: false,
            }
            return s.kind === 'area' ? (
              <Area key={s.key} {...common} {...lineProps} fill={`url(#${gradientId}-${s.key})`} />
            ) : (
              <Line key={s.key} {...common} {...lineProps} />
            )
          })}
          {showNow && (
            <ReferenceLine
              x={now}
              stroke="#fbbf24"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: 'Now', position: 'insideTopLeft', fill: '#fbbf24', fontSize: 10, offset: 6 }}
            />
          )}
          {selected != null && byTime.has(selected) && (
            <ReferenceLine x={selected} stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
})

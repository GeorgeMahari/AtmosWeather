import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ------------------------------------------------------------------ Section

interface SectionProps {
  id: string
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Section({ id, title, subtitle, action, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

// -------------------------------------------------------- Segmented control

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when the visible label is an abbreviation or icon. */
  ariaLabel?: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T | null
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

/** Radio-group semantics with roving focus and arrow-key navigation. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md', className }: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const index = Math.max(0, options.findIndex((o) => o.value === value))
    const next = options[(index + step + options.length) % options.length]!
    onChange(next.value)
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }

  const fallbackFocus = value === null || !options.some((o) => o.value === value)

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('inline-flex rounded-xl border border-line bg-white/5 p-0.5', className)}
    >
      {options.map((option, i) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            data-value={option.value}
            tabIndex={checked || (fallbackFocus && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-[0.625rem] font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3 text-sm',
              checked ? 'bg-white/15 text-ink shadow-sm' : 'text-ink-mute hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- Skeleton

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton', className)} />
}

// ------------------------------------------------------------------ States

interface StateProps {
  title: string
  message?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  compact?: boolean
  icon?: ReactNode
}

export function ErrorState({ title, message, onRetry, retryLabel = 'Try again', compact }: StateProps) {
  return (
    <div role="alert" className={cx('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-12')}>
      <TriangleAlert aria-hidden="true" className="size-7 text-amber" />
      <p className="text-base font-medium text-ink">{title}</p>
      {message && <p className="max-w-md text-sm text-ink-mute">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="chip mt-1">
          <RefreshCw aria-hidden="true" className="size-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, message, icon, compact }: StateProps) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-10')}>
      <span className="text-ink-mute">{icon ?? <CloudOff aria-hidden="true" className="size-7" />}</span>
      <p className="text-base font-medium text-ink">{title}</p>
      {message && <p className="max-w-md text-sm text-ink-mute">{message}</p>}
    </div>
  )
}

// -------------------------------------------------------------------- Meter

interface MeterProps {
  /** 0–1 position of the marker along the track. */
  fraction: number | null
  label: string
  /** Optional CSS gradient for the track (defaults to an accent fill). */
  track?: string
  /** Fill from the left up to the marker instead of showing a marker only. */
  fill?: boolean
}

export function Meter({ fraction, label, track, fill = true }: MeterProps) {
  if (fraction === null) return null
  const clamped = Math.min(1, Math.max(0, fraction))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative h-1.5 w-full rounded-full bg-white/10"
      style={track ? { background: track } : undefined}
    >
      {fill && !track && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent/80 transition-[width] duration-700 ease-out"
          style={{ width: `${clamped * 100}%` }}
        />
      )}
      {(track || !fill) && (
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow transition-[left] duration-700 ease-out"
          style={{ left: `${clamped * 100}%` }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Sparkline

interface SparklineProps {
  values: (number | null)[]
  /** Index to mark with a dot (e.g. the current hour). */
  markIndex?: number
  label: string
  className?: string
}

/** Tiny dependency-free trend line for metric cards. */
export function Sparkline({ values, markIndex, label, className }: SparklineProps) {
  const points = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (points.length < 2) return null
  const min = Math.min(...points.map((p) => p.v))
  const max = Math.max(...points.map((p) => p.v))
  const span = max - min || 1
  const width = 100
  const height = 28
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6)
  const path = points.map((p, n) => `${n === 0 ? 'M' : 'L'}${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ')
  const mark = markIndex !== undefined ? points.find((p) => p.i === markIndex) : undefined

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cx('h-7 w-full overflow-visible', className)}
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
      {mark && (
        // A zero-length round-capped stroke stays circular even though the SVG is stretched.
        <path d={`M${x(mark.i).toFixed(2)},${y(mark.v).toFixed(2)} l0.001,0`} stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}

import type { Maybe } from '../../types/weatherTypes'
import { cardinalDirection, cardinalName } from '../../utils/unitConversions'

interface WindCompassProps {
  /** Meteorological direction: where the wind comes FROM, degrees from north. */
  direction: Maybe<number>
  speedText: string
  className?: string
}

const TICKS = Array.from({ length: 36 }, (_, i) => i * 10)

export function WindCompass({ direction, speedText, className = 'size-36' }: WindCompassProps) {
  const label =
    direction === null
      ? 'Wind direction unavailable'
      : `Wind from the ${cardinalName(direction)} (${Math.round(direction)} degrees) at ${speedText}`

  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className={className}>
      <circle cx="60" cy="60" r="50" fill="rgb(255 255 255 / 0.03)" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1" />
      {TICKS.map((angle) => (
        <line
          key={angle}
          x1="60"
          y1={angle % 90 === 0 ? 11 : 12}
          x2="60"
          y2={angle % 90 === 0 ? 18 : angle % 30 === 0 ? 16 : 14}
          stroke={angle % 90 === 0 ? 'rgb(255 255 255 / 0.7)' : 'rgb(255 255 255 / 0.25)'}
          strokeWidth={angle % 90 === 0 ? 1.4 : 0.8}
          transform={`rotate(${angle} 60 60)`}
        />
      ))}
      {(
        [
          ['N', 60, 29],
          ['E', 93, 63.5],
          ['S', 60, 98],
          ['W', 27, 63.5],
        ] as const
      ).map(([letter, x, y]) => (
        <text
          key={letter}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill={letter === 'N' ? 'var(--accent)' : 'var(--color-ink-mute)'}
        >
          {letter}
        </text>
      ))}

      {direction !== null && (
        // Arrow drawn pointing down from the top: tail at the source bearing,
        // head toward where the air is moving.
        <g
          style={{
            transform: `rotate(${direction}deg)`,
            transformOrigin: '60px 60px',
            transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <line x1="60" y1="22" x2="60" y2="88" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 97 L53.5 84 L60 87.5 L66.5 84 Z" fill="var(--accent)" />
          <circle cx="60" cy="22" r="3.2" fill="var(--color-surface)" stroke="var(--accent)" strokeWidth="1.6" />
        </g>
      )}
      <circle cx="60" cy="60" r="17" fill="rgb(8 14 28 / 0.92)" stroke="rgb(255 255 255 / 0.12)" />
      <text x="60" y="64.5" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink)">
        {cardinalDirection(direction)}
      </text>
    </svg>
  )
}

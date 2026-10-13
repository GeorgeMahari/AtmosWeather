import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { useSettings } from '../../app/SettingsContext'
import { UNAVAILABLE, formatNumber } from '../../utils/unitConversions'

interface AnimatedNumberProps {
  value: number | null
  digits?: number
  className?: string
}

/**
 * Briefly tweens from the previous value to the new one when data refreshes.
 * The tween is short and monotonic, and the accessible text is always the
 * true value — it never rests on an intermediate number.
 */
export function AnimatedNumber({ value, digits = 0, className }: AnimatedNumberProps) {
  const { motionEnabled } = useSettings()
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const from = previous.current
    previous.current = value
    if (value === null) {
      node.textContent = UNAVAILABLE
      return
    }
    if (!motionEnabled || from === null || from === value) {
      node.textContent = formatNumber(value, digits)
      return
    }
    const controls = animate(from, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (latest) => {
        node.textContent = formatNumber(latest, digits)
      },
      onComplete: () => {
        node.textContent = formatNumber(value, digits)
      },
    })
    return () => controls.stop()
  }, [value, digits, motionEnabled])

  const text = value === null ? UNAVAILABLE : formatNumber(value, digits)
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

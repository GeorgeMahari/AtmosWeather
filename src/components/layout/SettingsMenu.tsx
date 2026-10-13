import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Settings2 } from 'lucide-react'
import { useSettings } from '../../app/SettingsContext'
import { Segmented, cx } from '../common/primitives'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        {hint && <p className="text-xs text-ink-mute">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export function SettingsMenu() {
  const { settings, unitSystem, setUnit, setUnitSystem, setTimeFormat, setEffects } = useSettings()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const { units } = settings

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label="Units and display settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 aria-hidden="true" className="size-[1.125rem]" />
      </button>

      <div
        role="dialog"
        aria-label="Units and display settings"
        className={cx(
          'glass-strong absolute top-full right-0 z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl p-4 shadow-2xl',
          !open && 'hidden',
        )}
      >
        <p className="mb-2 text-[0.6875rem] font-medium tracking-wider text-ink-mute uppercase">Units</p>
        <Row label="System" hint={unitSystem === 'custom' ? 'Custom mix' : undefined}>
          <Segmented
            size="sm"
            label="Unit system"
            value={unitSystem === 'custom' ? null : unitSystem}
            onChange={setUnitSystem}
            options={[
              { value: 'metric', label: 'Metric' },
              { value: 'imperial', label: 'Imperial' },
            ]}
          />
        </Row>
        <Row label="Temperature">
          <Segmented
            size="sm"
            label="Temperature unit"
            value={units.temperature}
            onChange={(v) => setUnit('temperature', v)}
            options={[
              { value: 'c', label: '°C', ariaLabel: 'Celsius' },
              { value: 'f', label: '°F', ariaLabel: 'Fahrenheit' },
            ]}
          />
        </Row>
        <Row label="Wind">
          <Segmented
            size="sm"
            label="Wind speed unit"
            value={units.wind}
            onChange={(v) => setUnit('wind', v)}
            options={[
              { value: 'kmh', label: 'km/h' },
              { value: 'ms', label: 'm/s' },
              { value: 'mph', label: 'mph' },
              { value: 'kn', label: 'kn', ariaLabel: 'knots' },
            ]}
          />
        </Row>
        <Row label="Precipitation">
          <Segmented
            size="sm"
            label="Precipitation unit"
            value={units.precipitation}
            onChange={(v) => setUnit('precipitation', v)}
            options={[
              { value: 'mm', label: 'mm' },
              { value: 'in', label: 'in', ariaLabel: 'inches' },
            ]}
          />
        </Row>
        <Row label="Pressure">
          <Segmented
            size="sm"
            label="Pressure unit"
            value={units.pressure}
            onChange={(v) => setUnit('pressure', v)}
            options={[
              { value: 'hpa', label: 'hPa', ariaLabel: 'hectopascals (millibars)' },
              { value: 'inhg', label: 'inHg', ariaLabel: 'inches of mercury' },
            ]}
          />
        </Row>
        <Row label="Distance">
          <Segmented
            size="sm"
            label="Distance unit"
            value={units.distance}
            onChange={(v) => setUnit('distance', v)}
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'mi', ariaLabel: 'miles' },
            ]}
          />
        </Row>

        <p className="mt-4 mb-2 text-[0.6875rem] font-medium tracking-wider text-ink-mute uppercase">Display</p>
        <Row label="Clock">
          <Segmented
            size="sm"
            label="Clock format"
            value={settings.timeFormat}
            onChange={setTimeFormat}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '24', label: '24h' },
              { value: '12', label: '12h' },
            ]}
          />
        </Row>
        <Row label="Visual effects" hint="Animated sky, rain and snow">
          <Segmented
            size="sm"
            label="Visual effects"
            value={settings.effects}
            onChange={setEffects}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Still' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <p className="mt-3 text-xs text-ink-mute">
          Preferences are saved in this browser. Your system&rsquo;s reduced-motion setting is always respected.
        </p>
      </div>
    </div>
  )
}

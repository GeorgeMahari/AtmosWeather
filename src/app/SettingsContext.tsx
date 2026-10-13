import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EffectsLevel, Settings, TimeFormat, UnitSettings } from '../types/weatherTypes'
import { STORAGE_KEYS, readStorage, writeStorage } from '../utils/storage'
import { IMPERIAL_UNITS, METRIC_UNITS, createFormatters } from '../utils/unitConversions'
import type { Formatters } from '../utils/unitConversions'

interface SettingsContextValue {
  settings: Settings
  fmt: Formatters
  /** Motion allowed: effects set to "full" and no OS reduced-motion preference. */
  motionEnabled: boolean
  setUnit: <K extends keyof UnitSettings>(key: K, value: UnitSettings[K]) => void
  setUnitSystem: (system: 'metric' | 'imperial') => void
  setTimeFormat: (format: TimeFormat) => void
  setEffects: (level: EffectsLevel) => void
  unitSystem: 'metric' | 'imperial' | 'custom'
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

function defaultSettings(): Settings {
  // The US is the main locale that expects imperial units by default.
  const imperial = typeof navigator !== 'undefined' && /-(US|LR|MM)$/i.test(navigator.language)
  return { units: imperial ? IMPERIAL_UNITS : METRIC_UNITS, timeFormat: 'auto', effects: 'full' }
}

function validateSettings(value: unknown): Settings | null {
  if (typeof value !== 'object' || value === null) return null
  const base = defaultSettings()
  const v = value as { units?: Record<string, unknown>; timeFormat?: unknown; effects?: unknown }
  const u = v.units ?? {}
  return {
    units: {
      temperature: oneOf(u.temperature, ['c', 'f'] as const, base.units.temperature),
      wind: oneOf(u.wind, ['kmh', 'ms', 'mph', 'kn'] as const, base.units.wind),
      precipitation: oneOf(u.precipitation, ['mm', 'in'] as const, base.units.precipitation),
      pressure: oneOf(u.pressure, ['hpa', 'inhg'] as const, base.units.pressure),
      distance: oneOf(u.distance, ['km', 'mi'] as const, base.units.distance),
    },
    timeFormat: oneOf(v.timeFormat, ['auto', '12', '24'] as const, 'auto'),
    effects: oneOf(v.effects, ['full', 'reduced', 'off'] as const, 'full'),
  }
}

const sameUnits = (a: UnitSettings, b: UnitSettings) =>
  (Object.keys(a) as (keyof UnitSettings)[]).every((key) => a[key] === b[key])

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(
    () => readStorage(STORAGE_KEYS.settings, validateSettings) ?? defaultSettings(),
  )
  const prefersReduced = usePrefersReducedMotion()

  useEffect(() => writeStorage(STORAGE_KEYS.settings, settings), [settings])

  const setUnit = useCallback<SettingsContextValue['setUnit']>((key, value) => {
    setSettings((s) => ({ ...s, units: { ...s.units, [key]: value } }))
  }, [])
  const setUnitSystem = useCallback((system: 'metric' | 'imperial') => {
    setSettings((s) => ({ ...s, units: system === 'imperial' ? IMPERIAL_UNITS : METRIC_UNITS }))
  }, [])
  const setTimeFormat = useCallback((timeFormat: TimeFormat) => setSettings((s) => ({ ...s, timeFormat })), [])
  const setEffects = useCallback((effects: EffectsLevel) => setSettings((s) => ({ ...s, effects })), [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      fmt: createFormatters(settings.units),
      motionEnabled: !prefersReduced && settings.effects === 'full',
      setUnit,
      setUnitSystem,
      setTimeFormat,
      setEffects,
      unitSystem: sameUnits(settings.units, METRIC_UNITS)
        ? 'metric'
        : sameUnits(settings.units, IMPERIAL_UNITS)
          ? 'imperial'
          : 'custom',
    }),
    [settings, prefersReduced, setUnit, setUnitSystem, setTimeFormat, setEffects],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}

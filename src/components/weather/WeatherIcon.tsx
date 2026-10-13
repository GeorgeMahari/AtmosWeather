import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Maybe } from '../../types/weatherTypes'
import { getCondition, getIconKey } from '../../utils/weatherConditions'
import type { IconKey } from '../../utils/weatherConditions'

const ICONS: Record<IconKey, { icon: LucideIcon; tint: string; motion?: 'spin' | 'float' }> = {
  sun: { icon: Sun, tint: 'text-amber', motion: 'spin' },
  moon: { icon: Moon, tint: 'text-ice', motion: 'float' },
  'sun-cloud': { icon: CloudSun, tint: 'text-amber', motion: 'float' },
  'moon-cloud': { icon: CloudMoon, tint: 'text-ice', motion: 'float' },
  cloud: { icon: Cloud, tint: 'text-ink-soft', motion: 'float' },
  clouds: { icon: Cloudy, tint: 'text-ink-soft', motion: 'float' },
  fog: { icon: CloudFog, tint: 'text-ink-soft', motion: 'float' },
  drizzle: { icon: CloudDrizzle, tint: 'text-ice', motion: 'float' },
  rain: { icon: CloudRain, tint: 'text-cyan', motion: 'float' },
  'rain-heavy': { icon: CloudRainWind, tint: 'text-cyan', motion: 'float' },
  sleet: { icon: CloudHail, tint: 'text-ice', motion: 'float' },
  snow: { icon: CloudSnow, tint: 'text-ink', motion: 'float' },
  'snow-heavy': { icon: Snowflake, tint: 'text-ink', motion: 'spin' },
  thunder: { icon: CloudLightning, tint: 'text-violet', motion: 'float' },
  hail: { icon: CloudHail, tint: 'text-violet', motion: 'float' },
  unknown: { icon: CloudOff, tint: 'text-ink-mute' },
}

interface WeatherIconProps {
  code: Maybe<number>
  isDay: boolean
  className?: string
  /** Gentle looping motion — used for the hero only. */
  animated?: boolean
  /** Provide when the icon is the only carrier of the condition. */
  labelled?: boolean
}

export function WeatherIcon({ code, isDay, className = 'size-6', animated = false, labelled = false }: WeatherIconProps) {
  const { icon: Icon, tint, motion } = ICONS[getIconKey(code, isDay)]
  const motionClass = animated && motion ? (motion === 'spin' ? 'wx-spin' : 'wx-float') : ''
  return (
    <Icon
      className={`${className} ${tint} ${motionClass}`}
      strokeWidth={1.5}
      {...(labelled ? { role: 'img', 'aria-label': getCondition(code).description } : { 'aria-hidden': true })}
    />
  )
}

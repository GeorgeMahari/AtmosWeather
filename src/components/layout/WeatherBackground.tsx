import { memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { EffectsLevel } from '../../types/weatherTypes'
import type { Scene } from '../../utils/weatherConditions'

interface WeatherBackgroundProps {
  scene: Scene
  effects: EffectsLevel
}

/**
 * Full-viewport scene behind the dashboard. Each scene is a layered CSS
 * composition (see globals.css); switching scenes cross-fades the layers.
 *  - full:    all layers, animated
 *  - reduced: sky, sun/moon, stars and clouds only — nothing moves
 *  - off:     the sky gradient alone
 */
export const WeatherBackground = memo(function WeatherBackground({ scene, effects }: WeatherBackgroundProps) {
  const fx = scene.effects
  const decorate = effects !== 'off'
  const particles = effects === 'full'

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-night">
      <AnimatePresence initial={false}>
        <motion.div
          key={`${scene.key}:${fx.snow}`}
          className={`scene scene-${scene.key}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        >
          {decorate && (
            <>
              {fx.stars && (
                <>
                  <div className="fx fx-stars" />
                  <div className="fx fx-stars fx-stars-b" />
                </>
              )}
              {fx.sun && <div className="fx fx-sun" />}
              {fx.moon && <div className="fx fx-moon" />}
              {fx.clouds >= 1 && <div className="fx fx-cloud c1" />}
              {fx.clouds >= 2 && <div className="fx fx-cloud c2" />}
              {fx.clouds >= 3 && (
                <>
                  <div className="fx fx-cloud c3" />
                  <div className="fx fx-cloud c4" />
                </>
              )}
              {fx.fog && (
                <>
                  <div className="fx fx-fog f1" />
                  <div className="fx fx-fog f2" />
                  <div className="fx fx-fog f3" />
                </>
              )}
              {fx.haze && <div className="fx fx-haze" />}
            </>
          )}
          {particles && (
            <>
              {fx.rain >= 1 && (
                <>
                  <div className="fx fx-rain" />
                  <div className="fx fx-rain fx-rain-b" />
                </>
              )}
              {fx.rain >= 2 && <div className="fx fx-rain fx-rain-heavy" />}
              {fx.snow >= 1 && (
                <>
                  <div className="fx fx-snow" />
                  <div className="fx fx-snow fx-snow-b" />
                </>
              )}
              {fx.snow >= 2 && <div className="fx fx-snow fx-snow-c" />}
              {fx.lightning && <div className="fx fx-lightning" />}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
})

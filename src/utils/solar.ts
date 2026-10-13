/**
 * Solar position computed locally from date, time and coordinates using the
 * NOAA low-accuracy equations (good to a fraction of a degree). This is
 * astronomy, not forecast data, so it is labelled "calculated" in the UI.
 */

const RAD = Math.PI / 180

export interface SolarPosition {
  /** Degrees above (+) or below (−) the horizon. */
  elevation: number
  /** Degrees clockwise from north. */
  azimuth: number
}

export function solarPosition(ms: number, latitude: number, longitude: number): SolarPosition {
  const date = new Date(ms)
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((ms - startOfYear) / 86_400_000) + 1
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600

  // Fractional year (radians)
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24)

  // Equation of time (minutes) and solar declination (radians)
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)

  const trueSolarMinutes = (((utcHours * 60 + eqTime + 4 * longitude) % 1440) + 1440) % 1440
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD
  const lat = latitude * RAD

  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)))
  const elevation = 90 - zenith / RAD

  const azimuth =
    (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180 + 360) % 360

  return { elevation, azimuth }
}

export function solarPhase(elevation: number): string {
  if (elevation > 6) return 'Daylight'
  if (elevation > -0.833) return 'Golden hour'
  if (elevation > -6) return 'Civil twilight'
  if (elevation > -12) return 'Nautical twilight'
  if (elevation > -18) return 'Astronomical twilight'
  return 'Night'
}

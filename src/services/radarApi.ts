import { ApiError, fetchJson } from './http'

/**
 * Precipitation radar mosaics from RainViewer's public API (no key).
 * https://www.rainviewer.com/api.html — past ~2 hours in 10-minute frames.
 * Kept behind this small module so another provider can be swapped in.
 */
const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json'

export interface RadarFrame {
  time: number
  tileUrl: string
}

export const RADAR_MAX_NATIVE_ZOOM = 7
export const RADAR_ATTRIBUTION = 'Radar © <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>'

export async function fetchRadarFrames(signal?: AbortSignal): Promise<RadarFrame[]> {
  const raw = await fetchJson(INDEX_URL, { signal, retries: 1, timeoutMs: 8000 })
  const root = raw as { host?: unknown; radar?: { past?: unknown } } | null
  const past = root?.radar?.past
  if (!root || typeof root.host !== 'string' || !Array.isArray(past)) {
    throw new ApiError('malformed', 'Unexpected radar index')
  }
  const host = root.host
  return past.flatMap((frame): RadarFrame[] => {
    const f = frame as { time?: unknown; path?: unknown }
    if (typeof f?.time !== 'number' || typeof f.path !== 'string') return []
    // /256 tile size · colour scheme 2 (universal blue) · smoothing on · snow shown
    return [{ time: f.time * 1000, tileUrl: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png` }]
  })
}

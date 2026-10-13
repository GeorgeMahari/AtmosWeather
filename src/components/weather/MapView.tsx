import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RADAR_ATTRIBUTION, RADAR_MAX_NATIVE_ZOOM } from '../../services/radarApi'

/**
 * Base map provider. Swap these two constants to change it — nothing else in
 * the app knows which tile service is used.
 */
const BASE_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const BASE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

export interface MapViewProps {
  latitude: number
  longitude: number
  locationName: string
  /** Radar tile template for the frame to show, or null for no overlay. */
  radarTileUrl: string | null
  onPick: (latitude: number, longitude: number) => void
}

/** Imperative Leaflet wrapper; default-exported so it can be lazy-loaded. */
export default function MapView({ latitude, longitude, locationName, radarTileUrl, onPick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const radarRef = useRef<L.TileLayer | null>(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = L.map(container, {
      center: [latitude, longitude],
      zoom: 7,
      minZoom: 2,
      maxZoom: 12,
      worldCopyJump: true,
      // Page scroll should not be hijacked; zoom with buttons, pinch or ctrl+wheel.
      scrollWheelZoom: false,
    })
    // The standard OSM style is light; its pane is darkened in CSS (.atmos-base-pane)
    // so only the base map is filtered, never the radar colours drawn above it.
    const basePane = map.createPane('atmos-base')
    basePane.classList.add('atmos-base-pane')
    basePane.style.zIndex = '150'
    L.tileLayer(BASE_TILES, { attribution: BASE_ATTRIBUTION, maxZoom: 19, pane: 'atmos-base' }).addTo(map)

    const marker = L.marker([latitude, longitude], {
      icon: L.divIcon({ className: '', html: '<div class="atmos-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      keyboard: false,
    }).addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng.wrap()
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'chip'
      button.textContent = 'Show weather here'
      const popup = L.popup({ closeButton: true }).setLatLng(event.latlng).setContent(button).openOn(map)
      button.addEventListener('click', () => {
        map.closePopup(popup)
        onPickRef.current(lat, lng)
      })
    })

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) map.scrollWheelZoom.enable()
      else map.scrollWheelZoom.disable()
    }
    container.addEventListener('wheel', onWheel, { capture: true, passive: true })

    mapRef.current = map
    markerRef.current = marker
    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true })
      map.remove()
      mapRef.current = null
      markerRef.current = null
      radarRef.current = null
    }
    // The map is created once; later coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.setLatLng([latitude, longitude])
    map.setView([latitude, longitude], map.getZoom(), { animate: true })
  }, [latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const previous = radarRef.current
    if (!radarTileUrl) {
      previous?.remove()
      radarRef.current = null
      return
    }
    const layer = L.tileLayer(radarTileUrl, {
      opacity: 0.7,
      maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
      maxZoom: 12,
      attribution: RADAR_ATTRIBUTION,
      zIndex: 5,
    }).addTo(map)
    radarRef.current = layer
    // Remove the old frame only once the new one has drawn, to avoid flicker.
    const drop = () => previous?.remove()
    layer.once('load', drop)
    const timeout = window.setTimeout(drop, 1500)
    return () => {
      window.clearTimeout(timeout)
      drop()
    }
  }, [radarTileUrl])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={`Interactive map centred on ${locationName}. Click the map to choose another location.`}
      className="h-[22rem] w-full sm:h-[28rem]"
    />
  )
}

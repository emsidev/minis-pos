"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"

import {
  getDefaultBoothMapCenter,
  OPEN_STREET_MAP_ATTRIBUTION,
  OPEN_STREET_MAP_TILE_URL,
  type BoothCoordinates,
  type BoothMapBounds,
} from "@/lib/boothMaps"
import { cn } from "@/lib/utils"

type BoothMapCanvasProps = {
  bounds?: BoothMapBounds | null
  center?: BoothCoordinates | null
  className?: string
  interactive?: boolean
  marker?: BoothCoordinates | null
  onSelect?: (coordinates: BoothCoordinates) => void
  zoom?: number
}

type LeafletModule = typeof import("leaflet")
type LeafletMap = import("leaflet").Map
type LeafletMarker = import("leaflet").Marker

function createBoothMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "booth-map-marker",
    html: '<span class="booth-map-marker__pin"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

export function BoothMapCanvas({
  bounds = null,
  center = null,
  className,
  interactive = true,
  marker = null,
  onSelect,
  zoom = 17,
}: BoothMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const onSelectRef = useRef(onSelect)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    let active = true
    let resizeObserver: ResizeObserver | null = null

    const initializeMap = async () => {
      try {
        const L = await import("leaflet")

        if (!active || !containerRef.current) {
          return
        }

        leafletRef.current = L

        const defaultCenter = getDefaultBoothMapCenter()
        const map = L.map(containerRef.current, {
          attributionControl: true,
          dragging: interactive,
          scrollWheelZoom: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          zoomControl: interactive,
        }).setView([defaultCenter.latitude, defaultCenter.longitude], zoom)

        L.tileLayer(OPEN_STREET_MAP_TILE_URL, {
          attribution: OPEN_STREET_MAP_ATTRIBUTION,
        }).addTo(map)

        map.on("click", (event) => {
          if (!interactive || !onSelectRef.current) {
            return
          }

          onSelectRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          })
        })

        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize()
        })
        resizeObserver.observe(containerRef.current)

        mapRef.current = map
        setLoadError(null)
        setIsReady(true)
      } catch {
        if (active) {
          setLoadError(
            "Map loading failed. You can still save the booth manually."
          )
          setIsReady(true)
        }
      }
    }

    void initializeMap()

    return () => {
      active = false
      resizeObserver?.disconnect()
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      leafletRef.current = null
      setIsReady(false)
      setLoadError(null)
    }
  }, [interactive, zoom])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current

    if (!map || !L) {
      return
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24] })
      return
    }

    const nextCenter = center ?? marker
    if (nextCenter) {
      map.setView([nextCenter.latitude, nextCenter.longitude], zoom)
    }
  }, [bounds, center, marker, zoom])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current

    if (!map || !L) {
      return
    }

    if (!marker) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    const position: [number, number] = [marker.latitude, marker.longitude]

    if (!markerRef.current) {
      markerRef.current = L.marker(position, {
        icon: createBoothMarkerIcon(L),
      }).addTo(map)
      return
    }

    markerRef.current.setLatLng(position)
  }, [marker])

  return (
    <div className={cn("bg-muted/20 relative min-h-[18rem]", className)}>
      <div ref={containerRef} className="h-full min-h-[18rem] w-full" />
      {!isReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            Loading map...
          </div>
        </div>
      ) : loadError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {loadError}
        </div>
      ) : null}
    </div>
  )
}

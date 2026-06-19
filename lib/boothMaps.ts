import type { Booth } from "@/lib/shifts"

export type BoothMapLocation = Pick<
  Booth,
  "name" | "google_maps_url" | "location_lat" | "location_lng" | "location_text"
>

export type BoothCoordinates = {
  latitude: number
  longitude: number
}

export type BoothMapBounds = [
  [latitude: number, longitude: number],
  [latitude: number, longitude: number],
]

export const OPEN_STREET_MAP_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

export const OPEN_STREET_MAP_ATTRIBUTION = "&copy; OpenStreetMap contributors"

export const BOOTH_MAP_DETAIL_ZOOM = 17
export const BOOTH_MAP_LINK_ZOOM = 19

const DEFAULT_BOOTH_MAP_CENTER: BoothCoordinates = {
  latitude: 12.8797,
  longitude: 121.774,
}

function parseCoordinate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCoordinateValue(value: number) {
  return value.toFixed(6)
}

export function getBoothCoordinates(
  booth: BoothMapLocation
): BoothCoordinates | null {
  const latitude = parseCoordinate(booth.location_lat)
  const longitude = parseCoordinate(booth.location_lng)

  if (latitude === null || longitude === null) {
    return null
  }

  return { latitude, longitude }
}

export function getDefaultBoothMapCenter() {
  return DEFAULT_BOOTH_MAP_CENTER
}

export function buildOpenStreetMapLink(
  latitude: number,
  longitude: number,
  zoom = BOOTH_MAP_LINK_ZOOM
) {
  const formattedLatitude = formatCoordinateValue(latitude)
  const formattedLongitude = formatCoordinateValue(longitude)

  return `https://www.openstreetmap.org/?mlat=${formattedLatitude}&mlon=${formattedLongitude}#map=${zoom}/${formattedLatitude}/${formattedLongitude}`
}

export function buildGoogleMapsLink(latitude: number, longitude: number) {
  const formattedLatitude = formatCoordinateValue(latitude)
  const formattedLongitude = formatCoordinateValue(longitude)

  return `https://www.google.com/maps?q=${formattedLatitude},${formattedLongitude}`
}

export function buildOpenStreetMapEmbedUrl(
  booth: BoothMapLocation,
  radius = 0.0025
) {
  const coordinates = getBoothCoordinates(booth)
  if (!coordinates) {
    return null
  }

  const south = coordinates.latitude - radius
  const north = coordinates.latitude + radius
  const west = coordinates.longitude - radius
  const east = coordinates.longitude + radius

  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    layer: "mapnik",
    marker: `${coordinates.latitude},${coordinates.longitude}`,
  })

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`
}

export function buildBoothMapLink(booth: BoothMapLocation) {
  const directUrl = booth.google_maps_url?.trim()
  if (directUrl) {
    return directUrl
  }

  const coordinates = getBoothCoordinates(booth)
  if (!coordinates) {
    return null
  }

  return buildGoogleMapsLink(coordinates.latitude, coordinates.longitude)
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { BoothMapCanvas } from "@/components/admin/BoothMapCanvas"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  buildGoogleMapsLink,
  getBoothCoordinates,
  type BoothCoordinates,
  type BoothMapBounds,
  type BoothMapLocation,
} from "@/lib/boothMaps"

type BoothLocationPickerProps = {
  boothName: string
  disabled?: boolean
  googleMapsUrl: string
  latitude: string
  locationText: string
  longitude: string
  onPlaceSelected: (value: {
    googleMapsUrl: string
    latitude: string
    locationText: string
    longitude: string
  }) => void
}

type OpenStreetMapSearchResult = {
  bounds: BoothMapBounds | null
  label: string
  raw: {
    display_name?: string
  }
  x: number
  y: number
}

type OpenStreetMapSearchProvider = {
  search: (value: { query: string }) => Promise<OpenStreetMapSearchResult[]>
}

function formatCoordinateInput(value: number) {
  return value.toFixed(6)
}

function buildSelectionValue(
  coordinates: BoothCoordinates,
  locationText: string
) {
  return {
    googleMapsUrl: buildGoogleMapsLink(
      coordinates.latitude,
      coordinates.longitude
    ),
    latitude: formatCoordinateInput(coordinates.latitude),
    locationText,
    longitude: formatCoordinateInput(coordinates.longitude),
  }
}

export function BoothLocationPicker({
  boothName,
  disabled = false,
  googleMapsUrl,
  latitude,
  locationText,
  longitude,
  onPlaceSelected,
}: BoothLocationPickerProps) {
  const searchProviderRef = useRef<OpenStreetMapSearchProvider | null>(null)
  const [searchQuery, setSearchQuery] = useState(locationText)
  const [searchResults, setSearchResults] = useState<
    OpenStreetMapSearchResult[]
  >([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchBounds, setSearchBounds] = useState<BoothMapBounds | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    setSearchQuery(locationText)
    setSearchResults([])
    setSearchError(null)
    setSearchBounds(null)
  }, [locationText])

  const boothPreview: BoothMapLocation = {
    google_maps_url: googleMapsUrl || null,
    location_lat: latitude || null,
    location_lng: longitude || null,
    location_text: locationText || null,
    name: boothName || "Booth location",
  }

  const selectedCoordinates = getBoothCoordinates(boothPreview)

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (!query) {
      setSearchError("Enter a place name or address, then search.")
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchBounds(null)

    try {
      if (!searchProviderRef.current) {
        const { OpenStreetMapProvider } = await import("leaflet-geosearch")
        searchProviderRef.current = new OpenStreetMapProvider({
          params: {
            "accept-language": "en",
          },
        }) as OpenStreetMapSearchProvider
      }

      const results = await searchProviderRef.current.search({
        query,
      })

      const nextResults = results.filter((result) => {
        return Number.isFinite(result.x) && Number.isFinite(result.y)
      })

      if (nextResults.length === 0) {
        setSearchResults([])
        setSearchError(
          "No places matched that search. You can still click the map or fill the fields manually."
        )
        return
      }

      setSearchResults(nextResults.slice(0, 5))
    } catch {
      setSearchResults([])
      setSearchError(
        "OpenStreetMap search is unavailable right now. You can still click the map or fill the fields manually."
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result: OpenStreetMapSearchResult) => {
    const nextCoordinates = {
      latitude: result.y,
      longitude: result.x,
    }
    const resolvedLocationText =
      result.raw.display_name?.trim() ||
      result.label.trim() ||
      locationText.trim() ||
      boothName.trim() ||
      "Pinned on map"

    setSearchBounds(result.bounds)
    setSearchQuery(resolvedLocationText)
    setSearchResults([])
    setSearchError(null)
    onPlaceSelected(buildSelectionValue(nextCoordinates, resolvedLocationText))
    toast.success("Booth location filled from OpenStreetMap.")
  }

  const handleMapSelect = (coordinates: BoothCoordinates) => {
    const resolvedLocationText =
      locationText.trim() || boothName.trim() || "Pinned on map"

    setSearchBounds(null)
    setSearchResults([])
    setSearchError(null)
    onPlaceSelected(buildSelectionValue(coordinates, resolvedLocationText))
    toast.success("Booth location pin updated.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[calc(var(--radius)-0.2rem)] border border-input bg-background px-3.5 py-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Search data-icon="inline-start" className="size-4" />
          Pin Location
          {isSearching ? (
            <Loader2 data-icon="inline-end" className="animate-spin" />
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={searchQuery}
            disabled={disabled}
            placeholder="Search for a market, mall, address, or landmark"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return
              }

              event.preventDefault()
              void handleSearch()
            }}
          />
          <Button
            type="button"
            disabled={disabled || isSearching}
            onClick={() => void handleSearch()}
          >
            <Search data-icon="inline-start" />
            Search
          </Button>
        </div>
      </div>

      {searchResults.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="app-kicker">Search Results</p>
          <div className="grid gap-2">
            {searchResults.map((result, index) => (
              <Button
                key={`${result.label}-${index}`}
                type="button"
                variant="outline"
                className="h-auto justify-start px-3 py-3 text-left"
                disabled={disabled}
                onClick={() => handleSelectResult(result)}
              >
                <div className="flex flex-col items-start gap-1 whitespace-normal">
                  <span className="text-sm font-medium text-foreground">
                    {result.raw.display_name?.trim() || result.label}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {searchError ? <FieldDescription>{searchError}</FieldDescription> : null}

      <div className="overflow-hidden rounded-[calc(var(--radius)-0.2rem)] border border-border">
        <BoothMapCanvas
          bounds={searchBounds}
          center={selectedCoordinates}
          marker={selectedCoordinates}
          interactive={!disabled}
          onSelect={handleMapSelect}
          className="min-h-[18rem]"
        />
      </div>
    </div>
  )
}

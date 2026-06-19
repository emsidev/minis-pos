import { MapPin } from "lucide-react"

import {
  buildOpenStreetMapEmbedUrl,
  getBoothCoordinates,
  type BoothMapLocation,
} from "@/lib/boothMaps"
import { cn } from "@/lib/utils"

type BoothMapPreviewProps = {
  booth: BoothMapLocation
  className?: string
  emptyDescription: string
  emptyTitle: string
}

export function BoothMapPreview({
  booth,
  className,
  emptyDescription,
  emptyTitle,
}: BoothMapPreviewProps) {
  const embedUrl = buildOpenStreetMapEmbedUrl(booth)
  const coordinates = getBoothCoordinates(booth)

  return (
    <div
      className={cn(
        "bg-muted/30 border-border overflow-hidden rounded-[calc(var(--radius)-0.2rem)] border",
        className
      )}
    >
      {coordinates ? (
        <iframe
          title={`${booth.name} map preview`}
          src={embedUrl ?? undefined}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full min-h-[18rem] w-full border-0"
        />
      ) : (
        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
            <MapPin />
          </div>
          <div className="space-y-1.5">
            <p className="text-foreground text-sm font-semibold">
              {emptyTitle}
            </p>
            <p className="text-muted-foreground text-sm leading-6">
              {emptyDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

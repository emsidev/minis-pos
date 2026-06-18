import type { MetadataRoute } from "next"

import { publicEnv } from "@/lib/env"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicEnv.appName,
    short_name: "Mini POS",
    description: "Offline-first point of sale for Mini's Pastries.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff4f8",
    theme_color: "#e040a0",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}

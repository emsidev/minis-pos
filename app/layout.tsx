import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import "@/app/globals.css"
import "leaflet/dist/leaflet.css"
import { publicEnv } from "@/lib/env"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  applicationName: publicEnv.appName,
  title: {
    default: publicEnv.appName,
    template: `%s | ${publicEnv.appName}`,
  },
  description: "Offline-first point of sale for Mini's Pastries.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: publicEnv.appName,
  },
}

export const viewport: Viewport = {
  themeColor: "#e040a0",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  )
}

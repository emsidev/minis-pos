import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import Script from "next/script"

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
        {process.env.NODE_ENV === "development" ? (
          <Script
            id="dev-sw-reset"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(){if(!("serviceWorker" in navigator)){return}var key="mini-pos:dev-sw-reset";navigator.serviceWorker.getRegistrations().then(function(registrations){var hadRegistrations=registrations.length>0;return Promise.all(registrations.map(function(registration){return registration.unregister()})).then(function(){return caches.keys().then(function(cacheKeys){return Promise.all(cacheKeys.filter(function(cacheKey){return cacheKey.indexOf("app-")===0||cacheKey.indexOf("workbox-")===0||cacheKey.indexOf("serwist")!==-1}).map(function(cacheKey){return caches.delete(cacheKey)}))})}).then(function(){if(hadRegistrations&&!window.sessionStorage.getItem(key)){window.sessionStorage.setItem(key,"1");window.location.reload()}})}).catch(function(){})})();`,
            }}
          />
        ) : null}
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  )
}

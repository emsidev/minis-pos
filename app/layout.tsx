import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"

import "@/app/globals.css"
import { publicEnv } from "@/lib/env"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
})

const dmSansDisplay = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: {
    default: publicEnv.appName,
    template: `%s | ${publicEnv.appName}`,
  },
  description: "Offline-first point of sale for Mini's Pastries.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSansDisplay.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}

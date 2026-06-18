"use client"

import { RouteErrorState } from "@/components/shared/RouteErrorState"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <RouteErrorState
          error={error}
          reset={reset}
          title="Something went wrong"
          description="The app could not finish this screen. Try again or return to the main workspace."
          homeHref="/"
          homeLabel="Go to workspace"
        />
      </body>
    </html>
  )
}

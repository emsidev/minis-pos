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
          description="This screen could not finish loading. Try again or go back."
          homeHref="/"
          homeLabel="Go to workspace"
        />
      </body>
    </html>
  )
}

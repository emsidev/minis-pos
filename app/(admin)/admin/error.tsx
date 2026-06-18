"use client"

import { RouteErrorState } from "@/components/shared/RouteErrorState"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="Admin screen unavailable"
      description="This admin screen could not load right now. Try again or return to the dashboard."
      homeHref="/admin/dashboard"
      homeLabel="Go to dashboard"
    />
  )
}

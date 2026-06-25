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
      description="This screen could not load. Try again or go back to the dashboard."
      homeHref="/admin/dashboard"
      homeLabel="Go to dashboard"
    />
  )
}

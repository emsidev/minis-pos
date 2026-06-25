"use client"

import { RouteErrorState } from "@/components/shared/RouteErrorState"

export default function EmployeeError({
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
      title="Employee screen unavailable"
      description="This screen could not load. Try again or go back to Counter."
      homeHref="/"
      homeLabel="Go to Counter"
    />
  )
}

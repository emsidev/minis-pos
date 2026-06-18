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
      description="This employee screen could not load right now. Try again or return to the Counter workspace."
      homeHref="/"
      homeLabel="Go to Counter"
    />
  )
}

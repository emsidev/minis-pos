"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyFooter,
  EmptyHeader,
  EmptyImage,
  EmptyTitle,
} from "@/components/ui/empty"

type RouteErrorStateProps = {
  description: string
  error: Error & { digest?: string }
  homeHref: string
  homeLabel: string
  reset: () => void
  title: string
}

export function RouteErrorState({
  description,
  error,
  homeHref,
  homeLabel,
  reset,
  title,
}: RouteErrorStateProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="app-page-center">
      <Empty className="max-w-xl">
        <EmptyImage>
          <AlertTriangle className="h-9 w-9" />
        </EmptyImage>

        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>

        <EmptyFooter>
          <Button type="button" size="lg" onClick={reset}>
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
          <Link href={homeHref}>
            <Button type="button" variant="outline" size="lg">
              {homeLabel}
            </Button>
          </Link>
        </EmptyFooter>
      </Empty>
    </div>
  )
}

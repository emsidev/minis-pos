import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function LoadingBanner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>
    </div>
  )
}

export function AdminKpiSkeletonGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-24" />
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

export function DataTableSkeleton({
  rows = 5,
  showToolbar = true,
}: {
  rows?: number
  showToolbar?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {showToolbar ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-full sm:max-w-sm" />
            <Skeleton className="h-10 w-full sm:w-[190px]" />
            <Skeleton className="h-10 w-full sm:w-[190px]" />
          </div>
          <Skeleton className="h-9 w-24 self-end sm:self-auto" />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[calc(var(--radius)+0.15rem)] border border-border bg-card">
        <div className="bg-muted/40 border-b border-border px-4 py-3">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-20" />
            ))}
          </div>
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-16 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>

      <div className="bg-border/40 grid grid-cols-7 gap-px overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-border">
        {Array.from({ length: 35 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[100px] bg-background p-2 sm:min-h-[140px]"
          >
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-10 w-4/5 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ShiftDetailSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function CounterSkeleton() {
  return (
    <div className="app-page pb-28 xl:pb-8">
      <div className="flex min-h-full flex-col gap-4 xl:flex-row xl:items-start">
        <section className="min-w-0 flex-1 space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <Skeleton className="h-9 w-52" />
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <Skeleton className="h-16 flex-1" />
                <Skeleton className="h-16 flex-1" />
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-52 w-full rounded-[calc(var(--radius)+0.2rem)]"
              />
            ))}
          </div>
        </section>

        <aside className="hidden w-full max-w-[31rem] shrink-0 xl:block">
          <Card className="h-[calc(100svh-7rem)]">
            <CardContent className="flex h-full flex-col gap-4 p-4">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
              <div className="mt-auto space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-12 w-12" />
                  <Skeleton className="h-12 flex-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function AdminBoothCardsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

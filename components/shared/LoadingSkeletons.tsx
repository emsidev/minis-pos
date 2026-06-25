import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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

function ScreenHeaderSkeleton({
  titleWidth = "w-48",
  descriptionWidth = "w-72",
  actionCount = 2,
}: {
  titleWidth?: string
  descriptionWidth?: string
  actionCount?: number
}) {
  return (
    <header className="app-screen-header">
      <div className="space-y-3">
        <Skeleton className={`h-8 ${titleWidth}`} />
        <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-28 rounded-full sm:w-32" />
        ))}
      </div>
    </header>
  )
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-20 w-full rounded-[calc(var(--radius)-0.15rem)] sm:h-24"
          />
        ))}
      </div>
    </div>
  )
}

function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border-border/60 overflow-hidden rounded-[var(--radius)] border">
      <div className="border-border/60 bg-background/70 grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-3 border-b px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-border/50 grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-3 border-b px-4 py-4 last:border-b-0"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="app-panel flex min-h-[13.5rem] flex-col gap-4 p-4 sm:p-5"
        >
          <Skeleton className="h-24 w-full rounded-[calc(var(--radius)-0.2rem)]" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="mt-auto flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MetricStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="app-panel flex flex-col gap-3 p-4 sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function EmployeeHomeRouteSkeleton() {
  return (
    <div className="app-page pb-28 xl:pb-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="app-panel space-y-4 p-4 sm:p-6">
            <ScreenHeaderSkeleton
              titleWidth="w-52"
              descriptionWidth="w-64"
              actionCount={2}
            />
            <Skeleton className="h-12 w-full rounded-[calc(var(--radius)-0.1rem)]" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-10 w-24 rounded-full sm:w-28"
                />
              ))}
            </div>
          </section>
          <ProductGridSkeleton />
        </div>
        <aside className="app-panel hidden h-[calc(100svh-7rem)] flex-col gap-4 p-4 xl:flex">
          <Skeleton className="h-7 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
          <div className="mt-auto space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function EmployeeScheduleRouteSkeleton() {
  return (
    <div className="app-page">
      <section className="app-panel space-y-5 p-4 sm:p-5">
        <ScreenHeaderSkeleton
          titleWidth="w-40"
          descriptionWidth="w-52"
          actionCount={3}
        />
        <CalendarSkeleton />
      </section>
    </div>
  )
}

export function EmployeeShiftRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <section className="app-panel space-y-5 p-4 sm:p-5">
        <ScreenHeaderSkeleton
          titleWidth="w-56"
          descriptionWidth="w-64"
          actionCount={2}
        />
        <MetricStripSkeleton count={3} />
        <TableRowsSkeleton rows={5} />
      </section>
    </div>
  )
}

export function AdminDashboardRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <ScreenHeaderSkeleton
        titleWidth="w-56"
        descriptionWidth="w-80"
        actionCount={2}
      />
      <MetricStripSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel space-y-4 p-4 sm:p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-72 w-full rounded-[calc(var(--radius)-0.15rem)]" />
        </section>
        <section className="app-panel space-y-4 p-4 sm:p-5">
          <Skeleton className="h-6 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AdminTableRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <ScreenHeaderSkeleton
        titleWidth="w-52"
        descriptionWidth="w-72"
        actionCount={2}
      />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-44 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
          <Skeleton className="ml-auto h-11 w-28 rounded-full" />
        </div>
        <TableRowsSkeleton rows={7} />
      </section>
    </div>
  )
}

export function AdminBoothsRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <ScreenHeaderSkeleton
        titleWidth="w-44"
        descriptionWidth="w-80"
        actionCount={3}
      />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-44 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
          <Skeleton className="ml-auto h-11 w-32 rounded-full" />
        </div>
        <CalendarSkeleton />
      </section>
    </div>
  )
}

export function AdminBoothDetailRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <section className="app-panel space-y-5 p-5 sm:p-6">
        <ScreenHeaderSkeleton
          titleWidth="w-56"
          descriptionWidth="w-72"
          actionCount={3}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <Skeleton className="h-64 w-full rounded-[calc(var(--radius)-0.15rem)]" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <TableRowsSkeleton rows={6} />
      </section>
    </div>
  )
}

export function AdminBulkScheduleRouteSkeleton() {
  return (
    <div className="app-page flex flex-col gap-6">
      <section className="app-panel space-y-5 p-5 sm:p-6">
        <ScreenHeaderSkeleton
          titleWidth="w-64"
          descriptionWidth="w-80"
          actionCount={2}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </section>
      <TableRowsSkeleton rows={8} />
    </div>
  )
}

"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { Store } from "lucide-react"

import { CounterClient } from "@/components/pos/CounterClient"
import { EmptyState } from "@/components/shared/EmptyState"
import type { CounterPromo } from "@/lib/promos"
import type { Product, SharedBoothSchedule } from "@/lib/shifts"
import { getCachedCounterWorkspace } from "@/lib/offlineData"
import { refreshActiveShiftWorkspace } from "@/lib/sync"
import { createClient } from "@/lib/supabase"

type EmployeeHomeClientProps = {
  employeeId: string
  initialWorkspace: {
    products: Product[]
    schedule: SharedBoothSchedule
    boothName?: string
    boothId?: string
    scheduleId?: string
  } | null
  availableProducts: Product[]
  promos: CounterPromo[]
  employeeRole: "employee" | "admin"
  preferCachedWorkspace?: boolean
}

export function EmployeeHomeClient({
  employeeId,
  initialWorkspace,
  availableProducts,
  promos,
  employeeRole,
  preferCachedWorkspace = false,
}: EmployeeHomeClientProps) {
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cachedWorkspace = useLiveQuery(
    () => getCachedCounterWorkspace(employeeId),
    [employeeId]
  )

  const shouldUseCachedWorkspace =
    typeof window !== "undefined" &&
    (!window.navigator.onLine || preferCachedWorkspace)
  const workspace = shouldUseCachedWorkspace
    ? (cachedWorkspace ?? initialWorkspace)
    : initialWorkspace

  useEffect(() => {
    if (
      workspace ||
      typeof window === "undefined" ||
      !window.navigator.onLine
    ) {
      return
    }

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        refreshActiveShiftWorkspace(employeeId)
          .then(() => {
            router.refresh()
          })
          .catch((error) => {
            console.warn("Counter empty-state refresh failed:", error)
          })
      }, 300)
    }

    const channel = supabase
      .channel(`employee-counter-empty-live-${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_assignments",
          filter: `employee_id=eq.${employeeId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedules",
          filter: `operator_employee_id=eq.${employeeId}`,
        },
        scheduleRefresh
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [employeeId, router, workspace])

  if (!workspace) {
    return (
      <div className="app-page-center">
        <EmptyState
          icon={<Store className="text-primary/60 h-12 w-12" />}
          title="No Active Shift"
          description="No booth is active for you right now."
          actionLabel="View Schedule"
          href="/schedule"
        />
      </div>
    )
  }

  return (
    <CounterClient
      initialProducts={workspace.products as Product[]}
      schedule={workspace.schedule}
      availableProducts={availableProducts}
      boothName={workspace.boothName}
      boothId={workspace.boothId}
      employeeId={employeeId}
      employeeRole={employeeRole}
      scheduleId={workspace.scheduleId}
      promos={promos}
      preferCachedWorkspace={false}
      preferCachedInventoryData={preferCachedWorkspace}
      canSell
      showShiftInventoryEditor
    />
  )
}

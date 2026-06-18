"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { Store } from "lucide-react"

import { CounterClient } from "@/components/pos/CounterClient"
import { EmptyState } from "@/components/shared/EmptyState"
import type { Product } from "@/lib/shifts"
import {
  getCachedCounterWorkspace,
  type CachedCounterWorkspace,
} from "@/lib/offlineData"

type EmployeeHomeClientProps = {
  employeeId: string
  initialWorkspace: CachedCounterWorkspace | null
  availableProducts: Product[]
  preferCachedWorkspace?: boolean
}

export function EmployeeHomeClient({
  employeeId,
  initialWorkspace,
  availableProducts,
  preferCachedWorkspace = false,
}: EmployeeHomeClientProps) {
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

  if (!workspace) {
    return (
      <div className="app-page-center">
        <EmptyState
          icon={<Store className="text-primary/60 h-12 w-12" />}
          title="No Active Shift"
          description="You do not have an active booth assignment right now. Check Booth Inventory or ask an admin to confirm today's booth schedule."
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
      scheduleId={workspace.scheduleId}
      preferCachedWorkspace={false}
      canSell
      showShiftInventoryEditor
    />
  )
}

"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Menu, RefreshCw, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { useLiveQuery } from "dexie-react-hooks"

import { Sidebar } from "@/components/shared/Sidebar"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  SyncProgressBanner,
  type SyncProgress,
} from "@/components/shared/SyncProgressBanner"
import { type AppRole } from "@/components/shared/navigation"
import { SignOutButton } from "@/components/shared/SignOutButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { db } from "@/lib/db"
import {
  bootstrapEmployeeOfflineDataIfStale,
  cancelFailedLocalSale,
  isEmployeeOfflineBootstrapFresh,
  refreshActiveShiftWorkspace,
  syncPendingPosOperations,
  type PosSyncResult,
} from "@/lib/sync"
import { formatCurrency } from "@/lib/utils"

type AppShellProps = {
  children: ReactNode
  role: AppRole
  userName: string
  employeeId?: string
}

type FailedSyncItem = {
  id: string
  kind: "sale" | "inventory"
  title: string
  detail: string
  error: string
  occurredAt: string
  canCancel: boolean
}

type OfflineSnapshotResponse =
  | {
      ok: true
    }
  | {
      ok?: false
      reason?: string
    }

function formatSyncFailureTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function getOfflineSnapshotFailureMessage(reason: string) {
  switch (reason) {
    case "auth-unavailable":
    case "profile-unavailable":
      return "Offline access could not refresh because the server connection failed. Any existing offline access was kept."
    case "snapshot-disabled":
      return "Offline access snapshots are not enabled for this setup."
    case "profile-missing":
      return "Offline access was reset because this sign-in has no employee profile."
    case "inactive":
      return "Offline access was reset because this employee profile is inactive."
    case "unauthenticated":
      return "Offline access was reset because the sign-in session is no longer valid."
    case "config":
      return "Offline access could not refresh because Supabase is not configured."
    default:
      return `Offline access could not refresh (${reason}).`
  }
}

function showSyncSummary(
  result: PosSyncResult,
  source: "reconnect" | "manual"
) {
  const syncedCount = result.sales + result.inventory

  if (syncedCount > 0) {
    toast.success(
      source === "reconnect"
        ? `Back online - ${syncedCount} operation${syncedCount !== 1 ? "s" : ""} synced.`
        : `${syncedCount} operation${syncedCount !== 1 ? "s" : ""} synced.`
    )
  } else if (
    source === "manual" &&
    result.failed === 0 &&
    result.conflicts === 0
  ) {
    toast.success("No failed local records were left to sync.")
  }

  if (result.conflicts > 0) {
    toast.error(
      "Inventory changed while offline. Review the shift before retrying."
    )
  }

  if (result.failed > 0) {
    toast.error(
      source === "manual"
        ? "Some failed records still need attention. Review the error list and retry."
        : "Some pending records still could not sync. Open Failed Syncs for details."
    )
  }
}

export function AppShell({
  children,
  role,
  userName,
  employeeId,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isPosShell = Boolean(employeeId) && !pathname.startsWith("/admin")
  const supportsOfflineSnapshot = role === "employee"
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [cancelTarget, setCancelTarget] = useState<FailedSyncItem | null>(null)
  const [cancelPendingId, setCancelPendingId] = useState<string | null>(null)
  const lastSnapshotWarningRef = useRef<string | null>(null)
  const isBusy = isSyncing || isReconnecting

  // Live count of locally queued or failed POS operations.
  const pendingCount = useLiveQuery(
    async () => {
      if (!isPosShell) {
        return 0
      }

      const [sales, inventory] = await Promise.all([
        db.sales
          .where("sync_state")
          .anyOf(["pending", "failed", "syncing"])
          .count(),
        db.inventoryEvents
          .where("sync_state")
          .anyOf(["pending", "failed", "syncing"])
          .count(),
      ])
      return sales + inventory
    },
    [isPosShell],
    0
  )
  const failedSyncItems = useLiveQuery(
    async () => {
      if (!isPosShell) {
        return []
      }

      const [failedSales, failedInventoryEvents] = await Promise.all([
        db.sales.where("sync_state").equals("failed").toArray(),
        db.inventoryEvents.where("sync_state").equals("failed").toArray(),
      ])

      return [
        ...failedSales.map(
          (sale): FailedSyncItem => ({
            id: sale.id,
            kind: "sale",
            title: `${formatCurrency(sale.total_amount)} sale`,
            detail: `${sale.payment_method.toUpperCase()} payment`,
            error: sale.sync_error ?? "Sync failed without a stored reason.",
            occurredAt: sale.created_at,
            canCancel:
              sale.sync_failure_kind === "conflict" ||
              sale.sync_failure_kind === "permanent",
          })
        ),
        ...failedInventoryEvents.map(
          (event): FailedSyncItem => ({
            id: event.id,
            kind: "inventory",
            title: `${event.event_type} inventory update`,
            detail: event.reason ?? "No adjustment reason recorded.",
            error: event.sync_error ?? "Sync failed without a stored reason.",
            occurredAt: event.occurred_at,
            canCancel: false,
          })
        ),
      ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    },
    [isPosShell],
    []
  )
  const failedCount = failedSyncItems.length
  const showReconnect = isPosShell && (isOffline || isReconnecting)
  const showReviewItems = isPosShell && !isBusy && !isOffline && failedCount > 0
  const showPendingItems =
    isPosShell &&
    !isBusy &&
    !isOffline &&
    failedCount === 0 &&
    pendingCount !== undefined &&
    pendingCount > 0

  const handleSyncProgress = useCallback(
    (step: number, totalSteps: number, label: string) => {
      setSyncProgress({ step, totalSteps, label })
    },
    []
  )

  const refreshOfflineSnapshot = useCallback(async () => {
    if (!employeeId || !window.navigator.onLine) {
      return false
    }

    try {
      const response = await fetch("/api/auth/offline-snapshot", {
        method: "POST",
        cache: "no-store",
      })

      const result = (await response
        .json()
        .catch(() => null)) as OfflineSnapshotResponse | null

      if (result?.ok === true) {
        lastSnapshotWarningRef.current = null
        return true
      }

      const reason =
        result?.reason ?? (response.ok ? "unknown" : `http-${response.status}`)

      console.warn("Employee snapshot refresh did not complete:", {
        reason,
        status: response.status,
      })

      if (lastSnapshotWarningRef.current !== reason) {
        lastSnapshotWarningRef.current = reason
        toast.warning(getOfflineSnapshotFailureMessage(reason))
      }

      return false
    } catch (error) {
      console.warn("Employee snapshot refresh failed:", error)

      if (lastSnapshotWarningRef.current !== "request-failed") {
        lastSnapshotWarningRef.current = "request-failed"
        toast.warning(getOfflineSnapshotFailureMessage("auth-unavailable"))
      }

      return false
    }
  }, [employeeId])

  const runPendingSync = useCallback(async (source: "reconnect" | "manual") => {
    setIsSyncing(true)

    try {
      const result = await syncPendingPosOperations({
        manual: source === "manual",
      })
      showSyncSummary(result, source)
      return result
    } catch (error) {
      console.error(
        source === "manual" ? "Manual sync failed:" : "Reconnect sync failed:",
        error
      )
      toast.error(
        source === "manual"
          ? "Unable to retry failed syncs."
          : "Sync failed. Sales will retry on next connection."
      )
      return null
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const reconnectOnlineState = useCallback(
    async (source: "auto" | "manual") => {
      if (!window.navigator.onLine) {
        setIsOffline(true)
        if (source === "manual") {
          toast.error("Reconnect to the internet before refreshing live data.")
        }
        return
      }

      setIsReconnecting(true)
      setSyncProgress(null)

      try {
        if (isPosShell && employeeId) {
          if (supportsOfflineSnapshot) {
            await refreshOfflineSnapshot()
          }

          const [pendingSales, pendingInventory] = await Promise.all([
            db.sales
              .where("sync_state")
              .anyOf(["pending", "failed", "syncing"])
              .count(),
            db.inventoryEvents
              .where("sync_state")
              .anyOf(["pending", "failed", "syncing"])
              .count(),
          ])

          if (pendingSales + pendingInventory > 0) {
            await runPendingSync(source === "auto" ? "reconnect" : "manual")
          }

          await bootstrapEmployeeOfflineDataIfStale(
            employeeId,
            handleSyncProgress,
            true
          )
        }

        router.refresh()

        if (source === "manual") {
          toast.success("Live data refreshed.")
        }
      } catch (error) {
        console.error("Reconnect refresh failed:", error)
        toast.error("Unable to refresh live data right now.")
      } finally {
        setIsReconnecting(false)
      }
    },
    [
      employeeId,
      handleSyncProgress,
      isPosShell,
      refreshOfflineSnapshot,
      router,
      runPendingSync,
      supportsOfflineSnapshot,
    ]
  )

  const handleSyncNow = useCallback(async () => {
    if (!window.navigator.onLine) {
      toast.error("Reconnect before retrying failed syncs.")
      return
    }

    await runPendingSync("manual")
  }, [runPendingSync])

  const handleReconnect = useCallback(async () => {
    await reconnectOnlineState("manual")
  }, [reconnectOnlineState])

  const handleCancelFailedSale = useCallback(async () => {
    if (!cancelTarget) {
      return
    }

    setCancelPendingId(cancelTarget.id)

    try {
      await cancelFailedLocalSale(cancelTarget.id)

      if (employeeId) {
        try {
          await refreshActiveShiftWorkspace(employeeId)
        } catch (error) {
          console.warn("Active shift refresh after cancellation failed:", error)
        }
      }

      router.refresh()
      toast.success("Failed local sale cancelled.")
      setCancelTarget(null)
    } catch (error) {
      console.error("Cancel failed sale failed:", error)
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to cancel this failed sale."
      )
    } finally {
      setCancelPendingId(null)
    }
  }, [cancelTarget, employeeId, router])

  useEffect(() => {
    const shouldBootstrapEmployeeData = isPosShell && Boolean(employeeId)

    const bootstrapOfflineData = async (syncPending = false) => {
      if (
        !shouldBootstrapEmployeeData ||
        !employeeId ||
        !window.navigator.onLine
      ) {
        return
      }

      try {
        const shouldWarmOfflineData =
          !isEmployeeOfflineBootstrapFresh(employeeId)

        if (shouldWarmOfflineData && supportsOfflineSnapshot) {
          await refreshOfflineSnapshot()
        }
        if (syncPending) {
          await syncPendingPosOperations()
        }
        if (shouldWarmOfflineData) {
          await bootstrapEmployeeOfflineDataIfStale(
            employeeId,
            handleSyncProgress
          )
        }
      } catch (error) {
        console.error("Employee offline bootstrap failed:", error)
        setSyncProgress(null)
      }
    }

    setIsOffline(!window.navigator.onLine)
    bootstrapOfflineData(true).catch((error) => {
      console.error("Initial employee offline bootstrap failed:", error)
    })

    const handleOffline = () => setIsOffline(true)

    const handleOnline = async () => {
      setIsOffline(false)
      await reconnectOnlineState("auto")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [
    employeeId,
    handleSyncProgress,
    isPosShell,
    reconnectOnlineState,
    refreshOfflineSnapshot,
    role,
    supportsOfflineSnapshot,
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border/80 bg-background/88 fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>

            <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Mini&apos;s Pastries
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {showReconnect ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
                disabled={isBusy}
                onClick={() => {
                  void handleReconnect()
                }}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={isBusy ? "animate-spin" : undefined}
                />
                Reconnect
              </Button>
            ) : null}

            {showReviewItems ? (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      className="hidden rounded-full px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] sm:inline-flex"
                    />
                  }
                >
                  <AlertTriangle data-icon="inline-start" />
                  {failedCount} to review
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 max-w-[92vw] p-0">
                  <PopoverHeader className="border-b border-border px-4 py-3">
                    <PopoverTitle>Needs Review</PopoverTitle>
                    <PopoverDescription>
                      These local POS records could not finish syncing online.
                    </PopoverDescription>
                  </PopoverHeader>
                  <ScrollArea className="max-h-80">
                    <div className="flex flex-col divide-y divide-border">
                      {failedSyncItems.map((item) => (
                        <div key={item.id} className="flex gap-3 px-4 py-3">
                          <div className="bg-destructive/10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-destructive">
                            <RefreshCw className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-medium text-foreground">
                                {item.title}
                              </p>
                              <Badge variant="outline" className="capitalize">
                                {item.kind}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatSyncFailureTime(item.occurredAt)} -{" "}
                              {item.detail}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-destructive">
                              {item.error}
                            </p>
                            {item.canCancel ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                disabled={isBusy || cancelPendingId === item.id}
                                onClick={() => setCancelTarget(item)}
                              >
                                {cancelPendingId === item.id ? (
                                  <RefreshCw
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                ) : null}
                                Cancel Local Sale
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                    <p className="flex-1 text-xs text-muted-foreground">
                      You will see items here after a retry hits a stock
                      conflict, receipt issue, or another sync error.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => {
                        void handleSyncNow()
                      }}
                    >
                      <RefreshCw
                        data-icon="inline-start"
                        className={isBusy ? "animate-spin" : undefined}
                      />
                      Sync Now
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            {showPendingItems ? (
              <Badge
                className="hidden rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] sm:inline-flex"
                variant="secondary"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {pendingCount} pending
              </Badge>
            ) : null}

            {isOffline ? (
              <Badge
                variant="destructive"
                className="hidden rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] sm:inline-flex"
              >
                <WifiOff className="mr-1 h-3.5 w-3.5" />
                {pendingCount !== undefined && pendingCount > 0
                  ? `Offline - ${pendingCount} pending`
                  : "Offline"}
              </Badge>
            ) : null}

            <div className="min-w-0 max-w-[9rem] text-right sm:max-w-[12rem]">
              <p className="truncate text-sm font-medium text-foreground">
                {userName}
              </p>
            </div>

            <SignOutButton buttonClassName="h-10 px-4 text-sm" />
          </div>
        </div>

        <SyncProgressBanner progress={syncProgress} />
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 lg:hidden">
          <div className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Open pages.</SheetDescription>
          </div>
          <Sidebar
            role={role}
            className="h-full rounded-none border-0 shadow-none"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="pt-[4.5rem] lg:pl-[18.5rem]">
        <aside className="fixed bottom-0 left-0 top-[4.5rem] hidden w-[18.5rem] p-4 lg:block">
          <Sidebar role={role} className="h-full" />
        </aside>

        <main className="flex min-h-[calc(100svh-4.5rem)] min-w-0 flex-col">
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && cancelPendingId === null) {
            setCancelTarget(null)
          }
        }}
        title="Cancel Failed Sale?"
        description="This removes the failed local sale from this device and restores its deducted stock. The transaction will not sync."
        confirmLabel="Cancel Local Sale"
        pendingLabel="Cancelling..."
        variant="destructive"
        onConfirm={handleCancelFailedSale}
      />
    </div>
  )
}

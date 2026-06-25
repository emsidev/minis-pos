"use client"

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { Package, ShoppingBag, Store } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"

import { CartProvider, useCart } from "@/components/pos/CartContext"
import { CategoryTabs } from "@/components/pos/CategoryTabs"
import { OrderSidebar } from "@/components/pos/OrderSidebar"
import { ProductCard } from "@/components/pos/ProductCard"
import { ShiftInventoryEditor } from "@/components/shifts/ShiftInventoryEditor"
import type { SellableProduct } from "@/components/pos/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  getBoothDisplayName,
  formatCurrency,
  getBusinessShiftState,
  hasStartedOperatorPeriod,
} from "@/lib/utils"
import {
  getCachedCounterPromos,
  getCachedCounterWorkspace,
  getCachedShiftDetails,
  hasInFlightScheduleOperations,
  type CachedCounterWorkspace,
  type CachedShiftDetails,
} from "@/lib/offlineData"
import {
  cacheCounterPromos,
  primeLocalShiftInventory,
  refreshActiveShiftWorkspace,
} from "@/lib/sync"
import { createClient } from "@/lib/supabase"
import type { CounterPromo } from "@/lib/promos"
import type { Product, SharedBoothSchedule } from "@/lib/shifts"

type CounterClientProps = {
  initialProducts: SellableProduct[]
  schedule?: SharedBoothSchedule
  availableProducts?: Product[]
  boothName?: string
  boothId?: string
  employeeId: string
  employeeRole: "employee" | "admin"
  scheduleId?: string
  promos: CounterPromo[]
  preferCachedWorkspace?: boolean
  preferCachedInventoryData?: boolean
  canSell?: boolean
  showShiftInventoryEditor?: boolean
  saleBlockedMessage?: string
}

type CounterWorkspaceProps = CounterClientProps

function CounterWorkspace({
  initialProducts,
  schedule: initialSchedule,
  availableProducts = [],
  boothName: initialBoothName,
  boothId: initialBoothId,
  employeeId,
  employeeRole,
  scheduleId: initialScheduleId,
  promos: initialPromos,
  preferCachedWorkspace = false,
  preferCachedInventoryData = false,
  canSell = Boolean(initialScheduleId && initialBoothId),
  showShiftInventoryEditor = Boolean(initialSchedule),
  saleBlockedMessage,
}: CounterWorkspaceProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState("All")
  const [isPending, startTransition] = useTransition()
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false)
  const [holdOptimisticInventory, setHoldOptimisticInventory] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { items, syncProductStock, total } = useCart()

  useEffect(() => {
    const sync = async () => {
      try {
        if (initialSchedule && showShiftInventoryEditor) {
          await primeLocalShiftInventory(
            initialSchedule,
            initialProducts as Product[],
            availableProducts
          )
        }
        await cacheCounterPromos(initialPromos)
      } catch (error) {
        console.error("Sync failed:", error)
      }
    }

    void sync()
  }, [availableProducts, initialProducts, initialPromos, initialSchedule, showShiftInventoryEditor])

  const cachedWorkspace = useLiveQuery<CachedCounterWorkspace | null>(
    () =>
      preferCachedWorkspace
        ? getCachedCounterWorkspace(employeeId)
        : Promise.resolve(null),
    [employeeId, preferCachedWorkspace]
  )
  const cachedShiftDetails = useLiveQuery<CachedShiftDetails>(
    () =>
      initialScheduleId
        ? getCachedShiftDetails(initialScheduleId)
        : Promise.resolve({
            schedule: null,
            products: [],
            sales: [],
            saleItems: [],
          }),
    [initialScheduleId]
  )
  const hasInFlightScheduleOps = useLiveQuery(
    () =>
      initialScheduleId
        ? hasInFlightScheduleOperations(initialScheduleId)
        : Promise.resolve(false),
    [initialScheduleId],
    false
  )
  const cachedPromos = useLiveQuery(() => getCachedCounterPromos(), [], [])

  const serverWorkspace = {
    products: initialProducts,
    boothName: initialBoothName,
    boothId: initialBoothId,
    scheduleId: initialScheduleId,
  }
  const displayWorkspace = cachedWorkspace ?? serverWorkspace
  const cachedProducts = cachedShiftDetails?.products ?? []
  const hasCachedShift = Boolean(cachedShiftDetails?.schedule)
  const shouldUseOptimisticInventory =
    typeof window !== "undefined" &&
    window.navigator.onLine &&
    !preferCachedWorkspace &&
    Boolean(initialScheduleId) &&
    hasCachedShift &&
    (cachedProducts.length > 0 || hasInFlightScheduleOps || holdOptimisticInventory)
  const displayProducts = (
    shouldUseOptimisticInventory && cachedProducts.length > 0
      ? cachedProducts
      : displayWorkspace.products
  ) as SellableProduct[]
  const displaySchedule =
    shouldUseOptimisticInventory && cachedShiftDetails?.schedule
      ? cachedShiftDetails.schedule
      : (cachedWorkspace?.schedule ?? initialSchedule)
  const displayPromos =
    typeof window !== "undefined" &&
    (!window.navigator.onLine || preferCachedWorkspace) &&
    cachedPromos.length > 0
      ? cachedPromos
      : initialPromos

  const displayBoothName =
    displayWorkspace.boothName ??
    (displaySchedule
      ? getBoothDisplayName(displaySchedule.booths)
      : undefined) ??
    initialBoothName
  const displayBoothId =
    displayWorkspace.boothId ?? displaySchedule?.booth_id ?? initialBoothId
  const displayScheduleId = displayWorkspace.scheduleId ?? displaySchedule?.id

  useEffect(() => {
    syncProductStock(displayProducts)
  }, [displayProducts, syncProductStock])

  const refreshActiveWorkspace = async () => {
    if (!initialScheduleId || typeof window === "undefined" || !window.navigator.onLine) {
      return
    }

    try {
      await refreshActiveShiftWorkspace(employeeId)
      router.refresh()
    } catch (error) {
      console.warn("Active Counter refresh failed:", error)
    }
  }

  const handleInventorySavePhaseChange = async (
    phase: "started" | "queued" | "reconciled"
  ) => {
    if (phase === "started" || phase === "queued") {
      setHoldOptimisticInventory(true)
      return
    }

    if (phase === "reconciled") {
      await refreshActiveWorkspace()
      setHoldOptimisticInventory(false)
    }
  }

  const categories = useMemo(() => {
    const categorySet = new Set(
      displayProducts.map((product) => product.category || "Artisanal")
    )
    return ["All", ...Array.from(categorySet)]
  }, [displayProducts])

  const deferredCategory = useDeferredValue(activeCategory)
  const filteredProducts = useMemo(() => {
    if (deferredCategory === "All") {
      return displayProducts
    }

    return displayProducts.filter(
      (product) => (product.category || "Artisanal") === deferredCategory
    )
  }, [deferredCategory, displayProducts])

  const productCountLabel =
    filteredProducts.length === 1
      ? "1 product"
      : `${filteredProducts.length} products`

  const inventoryReady = displayProducts.length > 0
  const orderSidebarBoothId = canSell ? displayBoothId : undefined
  const orderSidebarScheduleId = canSell && inventoryReady ? displayScheduleId : undefined
  const orderSidebarSchedule = canSell ? displaySchedule : undefined
  const shiftStarted = displaySchedule
    ? getBusinessShiftState(displaySchedule, {
        inventoryReady,
        manuallyStarted: hasStartedOperatorPeriod(
          displaySchedule.booth_schedule_operator_periods
        ),
      }).isOperational
    : false

  useEffect(() => {
    if (!initialScheduleId || typeof window === "undefined" || !window.navigator.onLine) {
      return
    }

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        void refreshActiveWorkspace()
      }, 300)
    }

    const channel = supabase
      .channel(`counter-live-${employeeId}-${initialScheduleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `schedule_id=eq.${initialScheduleId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promos" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promo_products" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedule_products", filter: `schedule_id=eq.${initialScheduleId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_events", filter: `schedule_id=eq.${initialScheduleId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedules", filter: `id=eq.${initialScheduleId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedule_assignments", filter: `schedule_id=eq.${initialScheduleId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "booth_schedule_assignments" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedule_operator_periods", filter: `schedule_id=eq.${initialScheduleId}` },
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
  }, [employeeId, initialScheduleId, router])

  if (
    displaySchedule &&
    displayProducts.length === 0 &&
    showShiftInventoryEditor
  ) {
    return (
      <div className="app-page flex flex-col gap-4">
        <div className="app-panel p-4 sm:p-6">
          <h2 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {displayBoothName || "Counter"}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Add opening stock before the first sale.
          </p>
        </div>
        <ShiftInventoryEditor
          schedule={displaySchedule}
          inventoryProducts={displayProducts as Product[]}
          availableProducts={availableProducts}
          employeeId={employeeId}
          preferCachedData={preferCachedInventoryData}
          onSavePhaseChange={handleInventorySavePhaseChange}
        />
      </div>
    )
  }

  return (
    <>
      <div className="app-page pb-28 xl:pb-8">
        <div className="flex min-h-full flex-col gap-4 xl:flex-row xl:items-start">
          <section className="min-w-0 flex-1 space-y-4">
            <div className="app-panel p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="app-screen-copy">
                  <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                    {displayBoothName || "Counter"}
                  </h2>
                  <p className="app-screen-description max-w-xl">
                    Sell from this booth.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:flex">
                  <div className="app-panel-muted flex items-center gap-3 px-4 py-3">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                      <Store className="h-4 w-4" />
                    </div>
                    <p className="text-foreground text-sm font-medium">
                      {productCountLabel}
                    </p>
                  </div>
                  <div className="app-panel-muted flex items-center gap-3 px-4 py-3">
                    <div className="bg-secondary/10 text-secondary flex h-10 w-10 items-center justify-center rounded-full">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <p className="text-foreground text-sm font-medium">
                      {items.length === 0 ? "Cart empty" : `${items.length} in cart`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              isPending={isPending}
              onCategoryChange={(category) => {
                startTransition(() => setActiveCategory(category))
              }}
            />

            {displaySchedule && showShiftInventoryEditor ? (
              <ShiftInventoryEditor
                schedule={displaySchedule}
                inventoryProducts={displayProducts as Product[]}
                availableProducts={availableProducts}
                employeeId={employeeId}
                compact
                preferCachedData={preferCachedInventoryData}
                onSavePhaseChange={handleInventorySavePhaseChange}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  featured={index % 4 === 0}
                />
              ))}

              {filteredProducts.length === 0 ? (
                <div className="app-panel col-span-full flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="bg-primary/8 text-primary flex h-14 w-14 items-center justify-center rounded-full">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-foreground text-lg font-semibold">
                      No products in this view
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Switch categories or update this booth&apos;s products.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden w-full max-w-[31rem] shrink-0 xl:sticky xl:top-[5.5rem] xl:block 2xl:max-w-[35rem]">
            <OrderSidebar
              boothId={orderSidebarBoothId}
              employeeId={employeeId}
              employeeRole={employeeRole}
              promos={displayPromos}
              scheduleId={orderSidebarScheduleId}
              schedule={orderSidebarSchedule}
              shiftStarted={shiftStarted}
              mode="docked"
              saleBlockedMessage={saleBlockedMessage}
              onOptimisticMutationChange={setHoldOptimisticInventory}
            />
          </aside>
        </div>
      </div>

      <div className="border-border/80 bg-background/94 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-foreground truncate text-sm font-medium">
                {items.length === 0
                  ? "No items"
                  : `${items.length} item${items.length === 1 ? "" : "s"}`}
              </p>
              {items.length > 0 ? (
                <Badge className="rounded-full px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                  {formatCurrency(total)}
                </Badge>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="rounded-full px-5"
            onClick={() => setMobileOrderOpen(true)}
          >
            Cart
          </Button>
        </div>
      </div>

      <Sheet open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}>
        <SheetContent side="bottom" className="p-0 xl:hidden">
          <div className="sr-only">
            <SheetTitle>Current order</SheetTitle>
            <SheetDescription>
              Review cart items, payment method, and complete the sale.
            </SheetDescription>
          </div>
          <OrderSidebar
            boothId={orderSidebarBoothId}
            employeeId={employeeId}
            employeeRole={employeeRole}
            promos={displayPromos}
            scheduleId={orderSidebarScheduleId}
            schedule={orderSidebarSchedule}
            shiftStarted={shiftStarted}
            mode="sheet"
            onChargeComplete={() => setMobileOrderOpen(false)}
            onOptimisticMutationChange={setHoldOptimisticInventory}
            saleBlockedMessage={saleBlockedMessage}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function CounterClient(props: CounterClientProps) {
  return (
    <CartProvider>
      <CounterWorkspace {...props} />
    </CartProvider>
  )
}

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
import { formatCurrency } from "@/lib/utils"
import {
  getCachedCounterWorkspace,
  type CachedCounterWorkspace,
} from "@/lib/offlineData"
import {
  primeLocalShiftInventory,
  refreshActiveShiftWorkspace,
} from "@/lib/sync"
import { createClient } from "@/lib/supabase"
import { toast } from "sonner"
import type { Product, SharedBoothSchedule } from "@/lib/shifts"

type CounterClientProps = {
  initialProducts: SellableProduct[]
  schedule?: SharedBoothSchedule
  availableProducts?: Product[]
  boothName?: string
  boothId?: string
  employeeId: string
  scheduleId?: string
  preferCachedWorkspace?: boolean
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
  scheduleId: initialScheduleId,
  preferCachedWorkspace = false,
  canSell = Boolean(initialScheduleId && initialBoothId),
  showShiftInventoryEditor = Boolean(initialSchedule),
  saleBlockedMessage,
}: CounterWorkspaceProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState("All")
  const [isPending, startTransition] = useTransition()
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false)
  const [inventoryReady, setInventoryReady] = useState(
    !initialSchedule || !canSell
  )
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { items, total } = useCart()

  // Prime the current server payload into Dexie. Network warm-up is owned by AppShell.
  useEffect(() => {
    const sync = async () => {
      try {
        if (initialSchedule && showShiftInventoryEditor) {
          await primeLocalShiftInventory(
            initialSchedule,
            initialProducts as Product[],
            availableProducts
          )
          setInventoryReady(true)
        }
      } catch (error) {
        console.error("Sync failed:", error)
        // Only toast if it's a real error, not just offline
        if (window.navigator.onLine) {
          toast.error("Failed to update local inventory. Using cached data.")
        }
      }
    }
    sync()
  }, [
    availableProducts,
    canSell,
    employeeId,
    initialProducts,
    initialSchedule,
    showShiftInventoryEditor,
  ])

  // 2. Reactive Data from Dexie
  const cachedWorkspace = useLiveQuery<CachedCounterWorkspace | null>(
    () =>
      preferCachedWorkspace
        ? getCachedCounterWorkspace(employeeId)
        : Promise.resolve(null),
    [employeeId, preferCachedWorkspace]
  )

  // 3. Data Priority: Local Cache > Server Props
  const displayWorkspace = cachedWorkspace ?? {
    products: initialProducts,
    boothName: initialBoothName,
    boothId: initialBoothId,
    scheduleId: initialScheduleId,
  }

  const displayProducts = displayWorkspace.products as SellableProduct[]
  const displayBoothName = displayWorkspace.boothName
  const displayBoothId = displayWorkspace.boothId
  const displayScheduleId = displayWorkspace.scheduleId
  const displaySchedule = cachedWorkspace?.schedule ?? initialSchedule

  const categories = useMemo(() => {
    const products = displayProducts
    const categorySet = new Set(
      products.map((product) => product.category || "Artisanal")
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

  const orderSidebarBoothId = canSell ? displayBoothId : undefined
  const orderSidebarScheduleId =
    canSell && inventoryReady ? displayScheduleId : undefined
  const orderSidebarSchedule = canSell ? displaySchedule : undefined

  useEffect(() => {
    if (!initialScheduleId || !window.navigator.onLine) {
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
            console.warn("Active Counter refresh failed:", error)
          })
      }, 300)
    }

    const channel = supabase
      .channel(`counter-live-${employeeId}-${initialScheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `schedule_id=eq.${initialScheduleId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_products",
          filter: `schedule_id=eq.${initialScheduleId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_events",
          filter: `schedule_id=eq.${initialScheduleId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedules",
          filter: `id=eq.${initialScheduleId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_operator_periods",
          filter: `schedule_id=eq.${initialScheduleId}`,
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
  }, [employeeId, initialScheduleId, router])

  if (
    displaySchedule &&
    displayProducts.length === 0 &&
    showShiftInventoryEditor
  ) {
    return (
      <div className="app-page flex flex-col gap-4">
        <div className="app-panel p-4 sm:p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {displayBoothName || "Counter"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This active shift needs opening inventory before sales can begin.
          </p>
        </div>
        <ShiftInventoryEditor
          schedule={displaySchedule}
          inventoryProducts={displayProducts as Product[]}
          availableProducts={availableProducts}
          employeeId={employeeId}
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
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {displayBoothName || "Counter"}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:flex">
                  <div className="app-panel-muted flex items-center gap-3 px-4 py-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full text-primary">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {productCountLabel}
                      </p>
                    </div>
                  </div>
                  <div className="app-panel-muted flex items-center gap-3 px-4 py-3">
                    <div className="bg-secondary/10 flex h-10 w-10 items-center justify-center rounded-full text-secondary">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {items.length === 0
                          ? "Cart empty"
                          : `${items.length} in cart`}
                      </p>
                    </div>
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
                  <div className="bg-primary/8 flex h-14 w-14 items-center justify-center rounded-full text-primary">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      No products in this view
                    </h3>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden w-full max-w-[31rem] shrink-0 xl:sticky xl:top-[5.5rem] xl:block 2xl:max-w-[35rem]">
            <OrderSidebar
              boothId={orderSidebarBoothId}
              employeeId={employeeId}
              scheduleId={orderSidebarScheduleId}
              schedule={orderSidebarSchedule}
              mode="docked"
              saleBlockedMessage={saleBlockedMessage}
            />
          </aside>
        </div>
      </div>

      <div className="border-border/80 bg-background/94 fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {items.length === 0
                  ? "No items"
                  : `${items.length} item${items.length === 1 ? "" : "s"}`}
              </p>
              {items.length > 0 ? (
                <Badge className="rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
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
            scheduleId={orderSidebarScheduleId}
            schedule={orderSidebarSchedule}
            mode="sheet"
            onChargeComplete={() => setMobileOrderOpen(false)}
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

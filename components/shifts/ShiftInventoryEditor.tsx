"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  CheckCircle2,
  CheckIcon,
  Loader2,
  Package,
  SlidersHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  getCachedAvailableProducts,
  getCachedShiftDetails,
} from "@/lib/offlineData"
import type { Product, SharedBoothSchedule } from "@/lib/shifts"
import { cn, isCurrentBusinessShift } from "@/lib/utils"
import { saveInventoryEventLocally, syncPendingPosOperations } from "@/lib/sync"

type ShiftInventoryEditorProps = {
  schedule: SharedBoothSchedule
  inventoryProducts: Product[]
  availableProducts: Product[]
  employeeId: string
  compact?: boolean
}

type QuantityValues = Record<string, string>

function buildQuantityValues(
  initialized: boolean,
  localProducts: Product[],
  productOptions: Product[]
): QuantityValues {
  if (!initialized) {
    return {}
  }

  return Object.fromEntries(
    productOptions.map((product) => [
      product.id,
      (
        localProducts.find((item) => item.id === product.id)?.stock ?? 0
      ).toString(),
    ])
  )
}

function buildInventorySourceKey(
  scheduleId: string,
  initialized: boolean,
  localProducts: Product[],
  productOptions: Product[]
) {
  const productState = productOptions
    .map((product) => {
      const current = localProducts.find((item) => item.id === product.id)
      return `${product.id}:${current?.stock ?? ""}:${current?.quantity ?? ""}`
    })
    .join("|")

  return `${scheduleId}:${initialized ? "ready" : "opening"}:${productState}`
}

function mergeProductOptions(
  inventoryProducts: Product[],
  availableProducts: Product[]
) {
  return Array.from(
    new Map(
      [...inventoryProducts, ...availableProducts].map((product) => [
        product.id,
        product,
      ])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name))
}

export function ShiftInventoryEditor({
  schedule,
  inventoryProducts,
  availableProducts,
  employeeId,
  compact = false,
}: ShiftInventoryEditorProps) {
  const cachedShift = useLiveQuery(
    () => getCachedShiftDetails(schedule.id),
    [schedule.id]
  )
  const cachedAvailableProducts = useLiveQuery(() =>
    getCachedAvailableProducts()
  )
  const localProducts =
    cachedShift?.products && cachedShift.products.length > 0
      ? cachedShift.products
      : inventoryProducts
  const productOptions = useMemo(
    () =>
      mergeProductOptions(
        localProducts,
        cachedAvailableProducts && cachedAvailableProducts.length > 0
          ? cachedAvailableProducts
          : availableProducts
      ),
    [availableProducts, cachedAvailableProducts, localProducts]
  )
  const initialized = localProducts.length > 0
  const [expanded, setExpanded] = useState(!initialized)
  const [quantities, setQuantities] = useState<QuantityValues>({})
  const [hasDraftChanges, setHasDraftChanges] = useState(false)
  const [pending, setPending] = useState(false)
  const quantitySeed = useMemo(
    () => buildQuantityValues(initialized, localProducts, productOptions),
    [initialized, localProducts, productOptions]
  )
  const inventorySourceKey = useMemo(
    () =>
      buildInventorySourceKey(
        schedule.id,
        initialized,
        localProducts,
        productOptions
      ),
    [initialized, localProducts, productOptions, schedule.id]
  )

  useEffect(() => {
    if (!initialized) {
      setExpanded(true)
    }
  }, [initialized])

  useEffect(() => {
    if (expanded && hasDraftChanges) {
      return
    }

    setQuantities(quantitySeed)
  }, [expanded, hasDraftChanges, inventorySourceKey, quantitySeed])

  const toggleOpeningProduct = (productId: string, selected: boolean) => {
    setHasDraftChanges(true)
    setQuantities((current) => {
      if (selected) {
        return { ...current, [productId]: current[productId] ?? "1" }
      }

      const next = { ...current }
      delete next[productId]
      return next
    })
  }

  const submitInventory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (
      !isCurrentBusinessShift(
        schedule.date,
        schedule.start_time,
        schedule.end_time
      )
    ) {
      toast.error("Inventory can be changed only while this shift is active.")
      return
    }

    const lines = initialized
      ? productOptions.map((product) => ({
          productId: product.id,
          resultingStock: Number(quantities[product.id] ?? "0"),
        }))
      : Object.entries(quantities).map(([productId, value]) => ({
          productId,
          resultingStock: Number(value),
        }))

    setPending(true)
    try {
      await saveInventoryEventLocally({
        scheduleId: schedule.id,
        schedule,
        employeeId,
        eventType: initialized ? "adjustment" : "opening",
        products: productOptions,
        currentInventory: localProducts,
        lines,
      })

      toast.success(
        initialized
          ? "Current stock updated."
          : "Opening inventory saved. Counter is ready."
      )
      setHasDraftChanges(false)
      setExpanded(false)

      if (window.navigator.onLine) {
        const synced = await syncPendingPosOperations()
        if (synced.conflicts > 0) {
          toast.error(
            "Stock is saved locally, but server inventory needs review before sync."
          )
        } else if (synced.failed > 0) {
          toast.error(
            "Stock is saved locally, but some records still could not sync."
          )
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save inventory."
      )
    } finally {
      setPending(false)
    }
  }

  if (!initialized || expanded) {
    return (
      <form
        className="app-panel flex flex-col gap-5 p-4 sm:p-5"
        onSubmit={submitInventory}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="app-kicker">
              {initialized ? "Stock Adjustment" : "Shift Start"}
            </p>
            <h2 className="text-lg font-semibold text-foreground">
              {initialized ? "Update on-hand stock" : "Enter opening inventory"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {initialized
                ? "Opening quantities remain in history; only current stock changes."
                : "Record stock on hand before accepting the first sale."}
            </p>
          </div>
          {initialized ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setHasDraftChanges(false)
                setExpanded(false)
              }}
            >
              Close
            </Button>
          ) : null}
        </div>

        {productOptions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No available products are cached for inventory setup. Connect to
            refresh products before starting this shift.
          </p>
        ) : (
          <FieldGroup data-slot="checkbox-group">
            {productOptions.map((product) => {
              const currentStock =
                localProducts.find((item) => item.id === product.id)?.stock ?? 0
              const selected = Object.prototype.hasOwnProperty.call(
                quantities,
                product.id
              )
              const quantityId = `inventory-quantity-${schedule.id}-${product.id}`

              return (
                <Field
                  key={product.id}
                  orientation="horizontal"
                  className="rounded-xl border border-border p-3"
                >
                  {!initialized ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() =>
                        toggleOpeningProduct(product.id, !selected)
                      }
                      className="focus-visible:ring-3 focus-visible:ring-ring/50 flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none transition-colors hover:text-foreground"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors",
                          selected &&
                            "border-primary bg-primary text-primary-foreground"
                        )}
                        aria-hidden="true"
                      >
                        {selected ? <CheckIcon className="size-3.5" /> : null}
                      </span>
                      <FieldContent className="min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {product.name}
                        </span>
                        <FieldDescription>
                          {product.category ?? "Pastry"}
                        </FieldDescription>
                      </FieldContent>
                    </button>
                  ) : (
                    <Package className="mt-1 size-4 shrink-0 text-primary" />
                  )}
                  {initialized ? (
                    <FieldContent>
                      <FieldLabel htmlFor={quantityId}>
                        {product.name}
                      </FieldLabel>
                      <FieldDescription>
                        {currentStock > 0 ||
                        localProducts.some((item) => item.id === product.id)
                          ? `Current stock: ${currentStock}`
                          : "New product for this shift"}
                      </FieldDescription>
                    </FieldContent>
                  ) : null}
                  {initialized || selected ? (
                    <Field className="w-24 shrink-0">
                      <FieldTitle>Qty</FieldTitle>
                      <Input
                        id={quantityId}
                        aria-label={`${product.name} stock quantity`}
                        type="number"
                        min={initialized ? "0" : "1"}
                        step="1"
                        required
                        value={quantities[product.id] ?? ""}
                        onChange={(inputEvent) => {
                          setHasDraftChanges(true)
                          setQuantities((current) => ({
                            ...current,
                            [product.id]: inputEvent.target.value,
                          }))
                        }}
                      />
                    </Field>
                  ) : null}
                </Field>
              )
            })}
          </FieldGroup>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending || productOptions.length === 0}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {initialized ? "Save Stock Adjustment" : "Start Selling"}
          </Button>
        </div>
      </form>
    )
  }

  const currentTotal = localProducts.reduce(
    (total, product) => total + (product.stock ?? 0),
    0
  )

  return (
    <div
      className={
        compact
          ? "border-primary/15 bg-primary/5 flex items-center justify-between gap-3 rounded-xl border p-3"
          : "app-panel flex items-center justify-between gap-4 p-4"
      }
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-5 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Inventory initialized
          </p>
          <p className="text-xs text-muted-foreground">
            {currentTotal} items currently on hand
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setHasDraftChanges(false)
          setExpanded(true)
        }}
      >
        <SlidersHorizontal data-icon="inline-start" />
        Adjust
      </Button>
    </div>
  )
}

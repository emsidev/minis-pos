"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Loader2, Package } from "lucide-react"
import { toast } from "sonner"

import { overrideShiftInventory } from "@/app/actions/adminBooths"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminSchedule } from "@/lib/adminBooths"
import type { Product } from "@/lib/shifts"

type InventoryOverrideSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: AdminSchedule | null
  products: Product[]
  onSaved: () => void
}

export function InventoryOverrideSheet({
  open,
  onOpenChange,
  schedule,
  products,
  onSaved,
}: InventoryOverrideSheetProps) {
  const [reason, setReason] = useState("")
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const productOptions = useMemo(() => {
    if (!schedule) {
      return products
    }

    return Array.from(
      new Map(
        [
          ...schedule.booth_schedule_products.flatMap((item) =>
            item.products ? [item.products] : []
          ),
          ...products,
        ].map((product) => [product.id, product])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name))
  }, [products, schedule])

  useEffect(() => {
    if (!open || !schedule) {
      return
    }

    setReason("")
    setQuantities(
      Object.fromEntries(
        productOptions.map((product) => [
          product.id,
          (
            schedule.booth_schedule_products.find(
              (item) => item.product_id === product.id
            )?.stock ?? 0
          ).toString(),
        ])
      )
    )
  }, [open, productOptions, schedule])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!schedule) {
      return
    }

    const lines = productOptions.flatMap((product) => {
      const previousStock =
        schedule.booth_schedule_products.find(
          (item) => item.product_id === product.id
        )?.stock ?? 0
      const resultingStock = Number(quantities[product.id] ?? "0")

      return previousStock === resultingStock
        ? []
        : [{ productId: product.id, previousStock, resultingStock }]
    })

    setPending(true)
    const result = await overrideShiftInventory({
      scheduleId: schedule.id,
      boothId: schedule.booth_id,
      reason,
      lines,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to override inventory.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="app-sheet-content max-w-xl"
      >
        <div className="app-sheet-header">
          <SheetTitle>Override Current Stock</SheetTitle>
          <SheetDescription>
            Correct on-hand counts for this active shift. Each changed count is
            recorded with your reason.
          </SheetDescription>
        </div>
        <div className="app-sheet-body">
          <form
            id="inventory-override-form"
            className="app-sheet-form"
            onSubmit={handleSubmit}
          >
            <Field>
              <FieldLabel htmlFor="override-reason">Reason</FieldLabel>
              <Input
                id="override-reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: physical recount after damaged items"
              />
              <FieldDescription>
                Required for the inventory audit trail.
              </FieldDescription>
            </Field>

            <FieldGroup>
              {productOptions.map((product) => {
                const existing = schedule?.booth_schedule_products.find(
                  (item) => item.product_id === product.id
                )

                return (
                  <Field
                    key={product.id}
                    orientation="horizontal"
                    className="border-border rounded-xl border p-3"
                  >
                    <Package className="text-primary mt-1 size-4 shrink-0" />
                    <FieldContent>
                      <FieldLabel htmlFor={`override-${product.id}`}>
                        {product.name}
                      </FieldLabel>
                      <FieldDescription>
                        {existing
                          ? `Opening: ${existing.quantity} / Current: ${existing.stock}`
                          : "Not yet stocked in this shift"}
                      </FieldDescription>
                    </FieldContent>
                    <Field className="w-24 shrink-0">
                      <FieldTitle>Qty</FieldTitle>
                      <Input
                        id={`override-${product.id}`}
                        aria-label={`${product.name} override quantity`}
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={quantities[product.id] ?? "0"}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [product.id]: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </Field>
                )
              })}
            </FieldGroup>
          </form>
        </div>
        <footer className="app-sheet-footer">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="inventory-override-form"
            className="w-full sm:w-auto"
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Record Override
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

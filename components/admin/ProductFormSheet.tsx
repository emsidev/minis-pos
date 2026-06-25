"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Cake, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { saveProduct, type ProductFormInput } from "@/app/actions/adminProducts"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminProductRecord } from "@/lib/adminProducts"
import {
  extractOptimisticRollback,
  type OptimisticMutationHandler,
} from "@/lib/optimistic"
import { cn } from "@/lib/utils"

type ProductFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: AdminProductRecord | null
  onSaved: (product: AdminProductRecord) => void
  onOptimisticSave?: OptimisticMutationHandler<ProductFormInput>
}

const blankForm: ProductFormInput = {
  name: "",
  price: "",
  category: "",
  imageUrl: "",
  isAvailable: true,
}

function productToForm(product: AdminProductRecord | null): ProductFormInput {
  if (!product) {
    return blankForm
  }

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category ?? "",
    imageUrl: product.image_url ?? "",
    isAvailable: product.is_available !== false,
  }
}

function AvailabilityButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn(
        "justify-start",
        !active && "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Cake data-icon="inline-start" />
      {label}
    </Button>
  )
}

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSaved,
  onOptimisticSave,
}: ProductFormSheetProps) {
  const [form, setForm] = useState<ProductFormInput>(blankForm)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(productToForm(product))
    }
  }, [open, product])

  const setValue = (field: keyof ProductFormInput, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const rollback = extractOptimisticRollback(onOptimisticSave?.(form))
    setPending(true)

    const result = await saveProduct(form)
    setPending(false)

    if (!result.ok) {
      rollback?.()
      toast.error(result.error ?? "Unable to save the product.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    if (result.product) {
      onSaved(result.product)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>{product ? "Edit Product" : "Add Product"}</SheetTitle>
          <SheetDescription>
            Keep the product catalog accurate for Counter and shift inventory
            setup.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="product-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product-name">Product name</FieldLabel>
                <Input
                  id="product-name"
                  required
                  value={form.name}
                  onChange={(event) => setValue("name", event.target.value)}
                  placeholder="Strawberry Donut"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="product-price">Price</FieldLabel>
                  <Input
                    id="product-price"
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => setValue("price", event.target.value)}
                    placeholder="95.00"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-category">Category</FieldLabel>
                  <Input
                    id="product-category"
                    value={form.category}
                    onChange={(event) =>
                      setValue("category", event.target.value)
                    }
                    placeholder="Donuts"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="product-image">Image URL</FieldLabel>
                <Input
                  id="product-image"
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => setValue("imageUrl", event.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <Field>
                <FieldLabel>Availability</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  <AvailabilityButton
                    active={form.isAvailable}
                    label="Available"
                    onClick={() => setValue("isAvailable", true)}
                  />
                  <AvailabilityButton
                    active={!form.isAvailable}
                    label="Hidden"
                    onClick={() => setValue("isAvailable", false)}
                  />
                </div>
                <FieldDescription>
                  Hidden products stay in history but are removed from Counter
                  and shift-start selection.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </div>
        <footer className="border-border flex shrink-0 justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={pending}>
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {product ? "Save Product" : "Create Product"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

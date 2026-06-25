"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Loader2, TicketPercent } from "lucide-react"
import { toast } from "sonner"

import { savePromo, type PromoFormInput } from "@/app/actions/adminProducts"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminProductRecord } from "@/lib/adminProducts"
import {
  getPromoSummary,
  type BuyXGetYBenefit,
  type BundlePriceBenefit,
  type CounterPromo,
  type FixedAmountOffBenefit,
  type FreeItemBenefit,
  type PercentOffBenefit,
  type PromoType,
  type SpecialPriceBenefit,
} from "@/lib/promos"
import type { PaymentMethod } from "@/lib/database.types"

type PromoFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  promo: CounterPromo | null
  products: AdminProductRecord[]
  onSaved: (promo: CounterPromo) => void
}

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "maribank", label: "Maribank" },
  { value: "unionbank", label: "UnionBank" },
  { value: "other", label: "Other" },
]

const PROMO_TYPE_OPTIONS: Array<{ value: PromoType; label: string }> = [
  { value: "percent_off", label: "Percent Off" },
  { value: "fixed_amount_off", label: "Fixed Amount Off" },
  { value: "special_price", label: "Special Price" },
  { value: "buy_x_get_y", label: "Buy X Get Y" },
  { value: "bundle_price", label: "Bundle Price" },
  { value: "free_item", label: "Free Item" },
]

const blankForm: PromoFormInput = {
  name: "",
  promoType: "percent_off",
  startsOn: "",
  endsOn: "",
  qualifyingProductIds: [],
  rewardProductIds: [],
  minCartSubtotal: "",
  minQualifyingQuantity: "",
  paymentMethods: [],
  requiresAdminApproval: false,
  isActive: true,
  percentOff: "",
  amountOff: "",
  specialPrice: "",
  buyQuantity: "",
  rewardQuantity: "",
  bundleQuantity: "",
  bundlePrice: "",
}

function toggleArrayValue(
  values: string[],
  nextValue: string,
  checked: boolean
) {
  if (checked) {
    return values.includes(nextValue) ? values : [...values, nextValue]
  }

  return values.filter((value) => value !== nextValue)
}

function togglePaymentMethod(
  values: PaymentMethod[],
  nextValue: PaymentMethod,
  checked: boolean
) {
  if (checked) {
    return values.includes(nextValue) ? values : [...values, nextValue]
  }

  return values.filter((value) => value !== nextValue)
}

function promoToForm(promo: CounterPromo | null): PromoFormInput {
  if (!promo) {
    return blankForm
  }

  const qualifyingProductIds = promo.products
    .filter((product) => product.role === "qualifying")
    .map((product) => product.productId)
  const rewardProductIds = promo.products
    .filter((product) => product.role === "reward")
    .map((product) => product.productId)

  return {
    id: promo.id,
    name: promo.name,
    promoType: promo.promoType,
    startsOn: promo.startsOn,
    endsOn: promo.endsOn,
    qualifyingProductIds,
    rewardProductIds,
    minCartSubtotal:
      promo.criteria.minCartSubtotal !== undefined
        ? String(promo.criteria.minCartSubtotal)
        : "",
    minQualifyingQuantity:
      promo.criteria.minQualifyingQuantity !== undefined
        ? String(promo.criteria.minQualifyingQuantity)
        : "",
    paymentMethods: promo.criteria.paymentMethods ?? [],
    requiresAdminApproval: promo.requiresAdminApproval,
    isActive: promo.isActive,
    percentOff:
      promo.promoType === "percent_off"
        ? String((promo.benefit as PercentOffBenefit).percentOff)
        : "",
    amountOff:
      promo.promoType === "fixed_amount_off"
        ? String((promo.benefit as FixedAmountOffBenefit).amountOff)
        : "",
    specialPrice:
      promo.promoType === "special_price"
        ? String((promo.benefit as SpecialPriceBenefit).specialPrice)
        : "",
    buyQuantity:
      promo.promoType === "buy_x_get_y"
        ? String((promo.benefit as BuyXGetYBenefit).buyQuantity)
        : "",
    rewardQuantity:
      promo.promoType === "buy_x_get_y" || promo.promoType === "free_item"
        ? String(
            promo.promoType === "buy_x_get_y"
              ? (promo.benefit as BuyXGetYBenefit).rewardQuantity
              : (promo.benefit as FreeItemBenefit).rewardQuantity
          )
        : "",
    bundleQuantity:
      promo.promoType === "bundle_price"
        ? String((promo.benefit as BundlePriceBenefit).bundleQuantity)
        : "",
    bundlePrice:
      promo.promoType === "bundle_price"
        ? String((promo.benefit as BundlePriceBenefit).bundlePrice)
        : "",
  }
}

function PromoProductChecklist({
  label,
  description,
  products,
  selectedProductIds,
  onToggle,
}: {
  label: string
  description: string
  products: AdminProductRecord[]
  selectedProductIds: string[]
  onToggle: (productId: string, checked: boolean) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((product) => {
          const checked = selectedProductIds.includes(product.id)

          return (
            <label
              key={product.id}
              className="border-border/70 bg-background/80 flex items-start gap-3 rounded-[calc(var(--radius)-0.2rem)] border px-3 py-3"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) =>
                  onToggle(product.id, Boolean(value))
                }
              />
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  {product.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {product.category ?? "Uncategorized"}
                </p>
              </div>
            </label>
          )
        })}
      </div>
    </Field>
  )
}

export function PromoFormSheet({
  open,
  onOpenChange,
  promo,
  products,
  onSaved,
}: PromoFormSheetProps) {
  const [form, setForm] = useState<PromoFormInput>(blankForm)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(promoToForm(promo))
    }
  }, [open, promo])

  const rewardProductsVisible =
    form.promoType === "buy_x_get_y" || form.promoType === "free_item"
  const previewPromo = useMemo<CounterPromo | null>(() => {
    if (!form.name.trim() || !form.startsOn || !form.endsOn) {
      return null
    }

    return {
      id: form.id ?? "preview",
      name: form.name.trim(),
      promoType: form.promoType,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      isActive: form.isActive,
      requiresAdminApproval: form.requiresAdminApproval,
      criteria: {
        ...(form.minCartSubtotal.trim()
          ? { minCartSubtotal: Number(form.minCartSubtotal) }
          : {}),
        ...(form.minQualifyingQuantity.trim()
          ? { minQualifyingQuantity: Number(form.minQualifyingQuantity) }
          : {}),
        ...(form.paymentMethods.length > 0
          ? { paymentMethods: form.paymentMethods }
          : {}),
      },
      benefit:
        form.promoType === "percent_off"
          ? { percentOff: Number(form.percentOff || 0) }
          : form.promoType === "fixed_amount_off"
            ? { amountOff: Number(form.amountOff || 0) }
            : form.promoType === "special_price"
              ? { specialPrice: Number(form.specialPrice || 0) }
              : form.promoType === "buy_x_get_y"
                ? {
                    buyQuantity: Number(form.buyQuantity || 0),
                    rewardQuantity: Number(form.rewardQuantity || 0),
                  }
                : form.promoType === "bundle_price"
                  ? {
                      bundleQuantity: Number(form.bundleQuantity || 0),
                      bundlePrice: Number(form.bundlePrice || 0),
                    }
                  : { rewardQuantity: Number(form.rewardQuantity || 0) },
      products: [
        ...form.qualifyingProductIds.map((productId) => ({
          productId,
          productName: products.find((product) => product.id === productId)
            ?.name,
          role: "qualifying" as const,
        })),
        ...form.rewardProductIds.map((productId) => ({
          productId,
          productName: products.find((product) => product.id === productId)
            ?.name,
          role: "reward" as const,
        })),
      ],
    }
  }, [form, products])

  const setValue = <K extends keyof PromoFormInput>(
    field: K,
    value: PromoFormInput[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)

    const result = await savePromo(form)
    setPending(false)

    if (!result.ok || !result.promo) {
      toast.error(result.error ?? "Unable to save the promo.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    onSaved(result.promo)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-[54rem] flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>{promo ? "Edit Promo" : "Add Promo"}</SheetTitle>
          <SheetDescription>
            Define the qualifying products, promo rule, criteria, and approval
            requirement.
          </SheetDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="promo-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="promo-name">Promo name</FieldLabel>
                <Input
                  id="promo-name"
                  required
                  value={form.name}
                  onChange={(event) => setValue("name", event.target.value)}
                  placeholder="Weekend Buy 1 Take 1"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel>Promo type</FieldLabel>
                  <Select
                    value={form.promoType}
                    onValueChange={(value) => {
                      const nextType = (value ?? "percent_off") as PromoType
                      setForm((current) => ({
                        ...current,
                        promoType: nextType,
                        rewardProductIds:
                          nextType === "buy_x_get_y" || nextType === "free_item"
                            ? current.rewardProductIds
                            : [],
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a promo type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMO_TYPE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="promo-starts-on">Start date</FieldLabel>
                  <Input
                    id="promo-starts-on"
                    required
                    type="date"
                    value={form.startsOn}
                    onChange={(event) =>
                      setValue("startsOn", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="promo-ends-on">End date</FieldLabel>
                  <Input
                    id="promo-ends-on"
                    required
                    type="date"
                    value={form.endsOn}
                    onChange={(event) => setValue("endsOn", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="promo-min-subtotal">
                    Minimum cart subtotal
                  </FieldLabel>
                  <Input
                    id="promo-min-subtotal"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.minCartSubtotal}
                    onChange={(event) =>
                      setValue("minCartSubtotal", event.target.value)
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="promo-min-qty">
                    Minimum qualifying quantity
                  </FieldLabel>
                  <Input
                    id="promo-min-qty"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={form.minQualifyingQuantity}
                    onChange={(event) =>
                      setValue("minQualifyingQuantity", event.target.value)
                    }
                    placeholder="Optional"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>Promo rule</FieldLabel>
                <div className="grid gap-3 md:grid-cols-2">
                  {form.promoType === "percent_off" ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.percentOff}
                      onChange={(event) =>
                        setValue("percentOff", event.target.value)
                      }
                      placeholder="Percent off"
                    />
                  ) : null}

                  {form.promoType === "fixed_amount_off" ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.amountOff}
                      onChange={(event) =>
                        setValue("amountOff", event.target.value)
                      }
                      placeholder="Amount off"
                    />
                  ) : null}

                  {form.promoType === "special_price" ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.specialPrice}
                      onChange={(event) =>
                        setValue("specialPrice", event.target.value)
                      }
                      placeholder="Special price per item"
                    />
                  ) : null}

                  {form.promoType === "buy_x_get_y" ? (
                    <>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={form.buyQuantity}
                        onChange={(event) =>
                          setValue("buyQuantity", event.target.value)
                        }
                        placeholder="Buy quantity"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={form.rewardQuantity}
                        onChange={(event) =>
                          setValue("rewardQuantity", event.target.value)
                        }
                        placeholder="Free quantity"
                      />
                    </>
                  ) : null}

                  {form.promoType === "bundle_price" ? (
                    <>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={form.bundleQuantity}
                        onChange={(event) =>
                          setValue("bundleQuantity", event.target.value)
                        }
                        placeholder="Bundle quantity"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={form.bundlePrice}
                        onChange={(event) =>
                          setValue("bundlePrice", event.target.value)
                        }
                        placeholder="Bundle price"
                      />
                    </>
                  ) : null}

                  {form.promoType === "free_item" ? (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={form.rewardQuantity}
                      onChange={(event) =>
                        setValue("rewardQuantity", event.target.value)
                      }
                      placeholder="Free item quantity"
                    />
                  ) : null}
                </div>
              </Field>

              <PromoProductChecklist
                label="Affected products"
                description="These products qualify for the promo."
                products={products}
                selectedProductIds={form.qualifyingProductIds}
                onToggle={(productId, checked) =>
                  setValue(
                    "qualifyingProductIds",
                    toggleArrayValue(
                      form.qualifyingProductIds,
                      productId,
                      checked
                    )
                  )
                }
              />

              {rewardProductsVisible ? (
                <PromoProductChecklist
                  label="Reward products"
                  description="These products become free or discounted as the reward."
                  products={products}
                  selectedProductIds={form.rewardProductIds}
                  onToggle={(productId, checked) =>
                    setValue(
                      "rewardProductIds",
                      toggleArrayValue(
                        form.rewardProductIds,
                        productId,
                        checked
                      )
                    )
                  }
                />
              ) : null}

              <Field>
                <FieldLabel>Allowed payment methods</FieldLabel>
                <FieldDescription>
                  Leave all unchecked to allow every payment method.
                </FieldDescription>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PAYMENT_OPTIONS.map((option) => {
                    const checked = form.paymentMethods.includes(option.value)

                    return (
                      <label
                        key={option.value}
                        className="border-border/70 bg-background/80 flex items-center gap-3 rounded-[calc(var(--radius)-0.2rem)] border px-3 py-3 text-sm font-medium"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setValue(
                              "paymentMethods",
                              togglePaymentMethod(
                                form.paymentMethods,
                                option.value,
                                Boolean(value)
                              )
                            )
                          }
                        />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
              </Field>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="border-border/70 bg-background/80 flex items-start gap-3 rounded-[calc(var(--radius)-0.2rem)] border px-3 py-3">
                  <Checkbox
                    checked={form.requiresAdminApproval}
                    onCheckedChange={(value) =>
                      setValue("requiresAdminApproval", Boolean(value))
                    }
                  />
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Requires admin approval
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Employees must request approval in Counter before using
                      it.
                    </p>
                  </div>
                </label>
                <label className="border-border/70 bg-background/80 flex items-start gap-3 rounded-[calc(var(--radius)-0.2rem)] border px-3 py-3">
                  <Checkbox
                    checked={form.isActive}
                    onCheckedChange={(value) =>
                      setValue("isActive", Boolean(value))
                    }
                  />
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Promo is active
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Inactive promos stay in history but disappear from
                      Counter.
                    </p>
                  </div>
                </label>
              </div>

              {previewPromo ? (
                <div className="border-border/70 bg-background/80 rounded-[calc(var(--radius)-0.2rem)] border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TicketPercent className="text-primary h-4 w-4" />
                    <p className="text-foreground text-sm font-semibold">
                      {getPromoSummary(previewPromo)}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {previewPromo.requiresAdminApproval
                      ? "Requires approval."
                      : "Can be applied directly in Counter."}
                  </p>
                </div>
              ) : null}
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
          <Button type="submit" form="promo-form" disabled={pending}>
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {promo ? "Save Promo" : "Create Promo"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

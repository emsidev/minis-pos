import type { Json } from "@/lib/database.types"
import type { PaymentMethod } from "@/lib/domain-types"

export const PROMO_TYPES = [
  "percent_off",
  "fixed_amount_off",
  "special_price",
  "buy_x_get_y",
  "bundle_price",
  "free_item",
] as const

export type PromoType = (typeof PROMO_TYPES)[number]
export type PromoProductRole = "qualifying" | "reward"

export type PromoCriteria = {
  minCartSubtotal?: number
  minQualifyingQuantity?: number
  paymentMethods?: PaymentMethod[]
}

export type PercentOffBenefit = {
  percentOff: number
}

export type FixedAmountOffBenefit = {
  amountOff: number
}

export type SpecialPriceBenefit = {
  specialPrice: number
}

export type BuyXGetYBenefit = {
  buyQuantity: number
  rewardQuantity: number
}

export type BundlePriceBenefit = {
  bundleQuantity: number
  bundlePrice: number
}

export type FreeItemBenefit = {
  rewardQuantity: number
}

export type PromoBenefit =
  | PercentOffBenefit
  | FixedAmountOffBenefit
  | SpecialPriceBenefit
  | BuyXGetYBenefit
  | BundlePriceBenefit
  | FreeItemBenefit

export type PromoProductLink = {
  productId: string
  productName?: string
  role: PromoProductRole
}

export type CounterPromo = {
  id: string
  name: string
  promoType: PromoType
  startsOn: string
  endsOn: string
  isActive: boolean
  requiresAdminApproval: boolean
  criteria: PromoCriteria
  benefit: PromoBenefit
  products: PromoProductLink[]
  createdAt?: string | null
  updatedAt?: string | null
}

export type PromoCartItem = {
  productId: string
  name?: string
  quantity: number
  unitPrice: number
}

export type PromoPricedItem = {
  productId: string
  quantity: number
  unitPrice: number
  baseUnitPrice: number
  discountAmount: number
}

export type PromoPricingResult =
  | {
      eligible: false
      reason: string
      subtotal: number
      discountTotal: number
      total: number
      discountByProductId: Record<string, number>
      pricedItems: PromoPricedItem[]
    }
  | {
      eligible: true
      subtotal: number
      discountTotal: number
      total: number
      discountByProductId: Record<string, number>
      pricedItems: PromoPricedItem[]
    }

type UnitRecord = {
  productId: string
  unitPriceCents: number
  discountCents: number
}

type NormalizedUnit = {
  productId: string
  unitPriceCents: number
}

type PromoSnapshotItem = {
  product_id: string
  quantity: number
  base_unit_price: number
}

export type PromoApprovalSnapshot = {
  promo_id: string
  promo_name: string
  promo_type: PromoType
  payment_method: PaymentMethod
  cart_items: PromoSnapshotItem[]
  subtotal: number
  promo_discount_total: number
  total_amount: number
}

function toCents(amount: number) {
  return Math.round(amount * 100)
}

function fromCents(amount: number) {
  return Number((amount / 100).toFixed(2))
}

function normalizePaymentMethods(value: unknown): PaymentMethod[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const methods = value.filter(
    (entry): entry is PaymentMethod =>
      typeof entry === "string" &&
      ["cash", "gcash", "maya", "maribank", "unionbank", "other"].includes(
        entry
      )
  )

  return methods.length > 0 ? methods : undefined
}

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function normalizePromoCriteria(value: unknown): PromoCriteria {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  const minCartSubtotal = readFiniteNumber(record.minCartSubtotal)
  const minQualifyingQuantity = readFiniteNumber(record.minQualifyingQuantity)

  return {
    ...(minCartSubtotal && minCartSubtotal > 0 ? { minCartSubtotal } : {}),
    ...(minQualifyingQuantity && minQualifyingQuantity > 0
      ? { minQualifyingQuantity }
      : {}),
    paymentMethods: normalizePaymentMethods(record.paymentMethods),
  }
}

export function normalizePromoBenefit(
  promoType: PromoType,
  value: unknown
): PromoBenefit {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  switch (promoType) {
    case "percent_off":
      return { percentOff: readFiniteNumber(record.percentOff) ?? 0 }
    case "fixed_amount_off":
      return { amountOff: readFiniteNumber(record.amountOff) ?? 0 }
    case "special_price":
      return { specialPrice: readFiniteNumber(record.specialPrice) ?? 0 }
    case "buy_x_get_y":
      return {
        buyQuantity: readFiniteNumber(record.buyQuantity) ?? 0,
        rewardQuantity: readFiniteNumber(record.rewardQuantity) ?? 0,
      }
    case "bundle_price":
      return {
        bundleQuantity: readFiniteNumber(record.bundleQuantity) ?? 0,
        bundlePrice: readFiniteNumber(record.bundlePrice) ?? 0,
      }
    case "free_item":
      return {
        rewardQuantity: readFiniteNumber(record.rewardQuantity) ?? 0,
      }
  }
}

export function normalizePromoRecord(input: {
  id: string
  name: string
  promo_type: PromoType
  starts_on: string
  ends_on: string
  is_active?: boolean | null
  requires_admin_approval?: boolean | null
  criteria?: Json | null
  benefit?: Json | null
  created_at?: string | null
  updated_at?: string | null
  promo_products?: Array<{
    product_id: string
    role: PromoProductRole
    products?: { name: string } | null
  }> | null
}): CounterPromo {
  return {
    id: input.id,
    name: input.name,
    promoType: input.promo_type,
    startsOn: input.starts_on,
    endsOn: input.ends_on,
    isActive: input.is_active !== false,
    requiresAdminApproval: input.requires_admin_approval === true,
    criteria: normalizePromoCriteria(input.criteria ?? {}),
    benefit: normalizePromoBenefit(input.promo_type, input.benefit ?? {}),
    products: (input.promo_products ?? []).map((product) => ({
      productId: product.product_id,
      productName: product.products?.name ?? undefined,
      role: product.role,
    })),
    createdAt: input.created_at ?? null,
    updatedAt: input.updated_at ?? null,
  }
}

export function isPromoActiveForDate(
  promo: CounterPromo,
  businessDate: string
) {
  return (
    promo.isActive &&
    promo.startsOn <= businessDate &&
    promo.endsOn >= businessDate
  )
}

function expandUnits(items: PromoCartItem[]) {
  const units: NormalizedUnit[] = []

  for (const item of items) {
    const unitPriceCents = toCents(item.unitPrice)
    for (let index = 0; index < item.quantity; index += 1) {
      units.push({
        productId: item.productId,
        unitPriceCents,
      })
    }
  }

  return units
}

function buildUnitRecords(items: PromoCartItem[]) {
  return expandUnits(items).map<UnitRecord>((unit) => ({
    productId: unit.productId,
    unitPriceCents: unit.unitPriceCents,
    discountCents: 0,
  }))
}

function selectRoles(
  promo: CounterPromo,
  role: PromoProductRole
): Set<string> | null {
  const productIds = promo.products
    .filter((product) => product.role === role)
    .map((product) => product.productId)

  return productIds.length > 0 ? new Set(productIds) : null
}

function compressPricedItems(records: UnitRecord[]) {
  const groups = new Map<string, PromoPricedItem>()
  const discountByProductId = new Map<string, number>()

  for (const record of records) {
    const finalPriceCents = Math.max(
      0,
      record.unitPriceCents - record.discountCents
    )
    const key = [
      record.productId,
      finalPriceCents,
      record.unitPriceCents,
      record.discountCents,
    ].join(":")
    const existing = groups.get(key)

    if (existing) {
      existing.quantity += 1
      existing.discountAmount = fromCents(
        toCents(existing.discountAmount) + record.discountCents
      )
    } else {
      groups.set(key, {
        productId: record.productId,
        quantity: 1,
        unitPrice: fromCents(finalPriceCents),
        baseUnitPrice: fromCents(record.unitPriceCents),
        discountAmount: fromCents(record.discountCents),
      })
    }

    discountByProductId.set(
      record.productId,
      (discountByProductId.get(record.productId) ?? 0) +
        fromCents(record.discountCents)
    )
  }

  return {
    pricedItems: Array.from(groups.values()).sort((left, right) =>
      left.productId.localeCompare(right.productId)
    ),
    discountByProductId: Object.fromEntries(discountByProductId),
  }
}

function resultWithReason(
  reason: string,
  subtotalCents: number,
  records: UnitRecord[]
): PromoPricingResult {
  const compressed = compressPricedItems(records)

  return {
    eligible: false,
    reason,
    subtotal: fromCents(subtotalCents),
    discountTotal: 0,
    total: fromCents(subtotalCents),
    discountByProductId: compressed.discountByProductId,
    pricedItems: compressed.pricedItems,
  }
}

function finalizeEligibleResult(
  subtotalCents: number,
  records: UnitRecord[]
): PromoPricingResult {
  const discountTotalCents = records.reduce(
    (total, record) => total + record.discountCents,
    0
  )
  const compressed = compressPricedItems(records)

  return {
    eligible: true,
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountTotalCents),
    total: fromCents(subtotalCents - discountTotalCents),
    discountByProductId: compressed.discountByProductId,
    pricedItems: compressed.pricedItems,
  }
}

function distributeFixedDiscount(
  records: UnitRecord[],
  selectedIndexes: number[],
  discountCents: number
) {
  let remainingDiscount = discountCents

  for (const index of selectedIndexes) {
    if (remainingDiscount <= 0) {
      break
    }

    const record = records[index]
    const maxDiscount = record.unitPriceCents - record.discountCents
    const appliedDiscount = Math.min(maxDiscount, remainingDiscount)

    record.discountCents += appliedDiscount
    remainingDiscount -= appliedDiscount
  }
}

function indexesForRole(
  records: UnitRecord[],
  productIds: Set<string> | null
): number[] {
  return records.flatMap((record, index) =>
    !productIds || productIds.has(record.productId) ? [index] : []
  )
}

function sortedIndexesByPrice(
  records: UnitRecord[],
  indexes: number[],
  direction: "asc" | "desc"
) {
  return indexes
    .slice()
    .sort((left, right) =>
      direction === "asc"
        ? records[left].unitPriceCents - records[right].unitPriceCents
        : records[right].unitPriceCents - records[left].unitPriceCents
    )
}

export function evaluatePromoSelection(input: {
  promo: CounterPromo
  items: PromoCartItem[]
  businessDate: string
  paymentMethod?: PaymentMethod
}): PromoPricingResult {
  const records = buildUnitRecords(input.items)
  const subtotalCents = records.reduce(
    (total, record) => total + record.unitPriceCents,
    0
  )

  if (!isPromoActiveForDate(input.promo, input.businessDate)) {
    return resultWithReason(
      "This promo is not active today.",
      subtotalCents,
      records
    )
  }

  const criteria = input.promo.criteria
  if (
    criteria.paymentMethods &&
    criteria.paymentMethods.length > 0 &&
    input.paymentMethod &&
    !criteria.paymentMethods.includes(input.paymentMethod)
  ) {
    return resultWithReason(
      "This promo does not apply to the selected payment method.",
      subtotalCents,
      records
    )
  }

  const qualifyingProducts = selectRoles(input.promo, "qualifying")
  const rewardProducts = selectRoles(input.promo, "reward")
  const qualifyingIndexes = indexesForRole(records, qualifyingProducts)
  const rewardIndexes = indexesForRole(
    records,
    rewardProducts ?? qualifyingProducts
  )
  const qualifyingQuantity = qualifyingIndexes.length

  if (qualifyingQuantity === 0) {
    return resultWithReason(
      "Add the required products to use this promo.",
      subtotalCents,
      records
    )
  }

  if (
    criteria.minQualifyingQuantity &&
    qualifyingQuantity < criteria.minQualifyingQuantity
  ) {
    return resultWithReason(
      "Add more qualifying items to use this promo.",
      subtotalCents,
      records
    )
  }

  if (
    criteria.minCartSubtotal &&
    subtotalCents < toCents(criteria.minCartSubtotal)
  ) {
    return resultWithReason(
      "Cart total is below this promo's minimum.",
      subtotalCents,
      records
    )
  }

  switch (input.promo.promoType) {
    case "percent_off": {
      const benefit = input.promo.benefit as PercentOffBenefit
      const percentOff = Math.max(0, Math.min(100, benefit.percentOff))

      if (percentOff <= 0) {
        return resultWithReason(
          "This promo has no discount configured.",
          subtotalCents,
          records
        )
      }

      for (const index of qualifyingIndexes) {
        const discountCents = Math.round(
          (records[index].unitPriceCents * percentOff) / 100
        )
        records[index].discountCents += discountCents
      }

      return finalizeEligibleResult(subtotalCents, records)
    }
    case "fixed_amount_off": {
      const benefit = input.promo.benefit as FixedAmountOffBenefit
      const amountOffCents = toCents(Math.max(0, benefit.amountOff))

      if (amountOffCents <= 0) {
        return resultWithReason(
          "This promo has no discount configured.",
          subtotalCents,
          records
        )
      }

      distributeFixedDiscount(
        records,
        sortedIndexesByPrice(records, qualifyingIndexes, "desc"),
        amountOffCents
      )

      return finalizeEligibleResult(subtotalCents, records)
    }
    case "special_price": {
      const benefit = input.promo.benefit as SpecialPriceBenefit
      const specialPriceCents = toCents(Math.max(0, benefit.specialPrice))

      for (const index of qualifyingIndexes) {
        const discountCents = Math.max(
          0,
          records[index].unitPriceCents - specialPriceCents
        )
        records[index].discountCents += discountCents
      }

      return finalizeEligibleResult(subtotalCents, records)
    }
    case "buy_x_get_y": {
      const benefit = input.promo.benefit as BuyXGetYBenefit
      const buyQuantity = Math.max(0, Math.floor(benefit.buyQuantity))
      const rewardQuantity = Math.max(0, Math.floor(benefit.rewardQuantity))

      if (buyQuantity <= 0 || rewardQuantity <= 0) {
        return resultWithReason(
          "This promo has incomplete buy/get rules.",
          subtotalCents,
          records
        )
      }

      const freeUnitCount =
        Math.floor(qualifyingQuantity / buyQuantity) * rewardQuantity

      if (freeUnitCount <= 0) {
        return resultWithReason(
          "Add more qualifying items to use this promo.",
          subtotalCents,
          records
        )
      }

      const rewardUnitIndexes = sortedIndexesByPrice(
        records,
        rewardIndexes,
        "asc"
      ).slice(0, freeUnitCount)

      if (rewardUnitIndexes.length === 0) {
        return resultWithReason(
          "Add the promo reward item to the cart.",
          subtotalCents,
          records
        )
      }

      for (const index of rewardUnitIndexes) {
        records[index].discountCents = records[index].unitPriceCents
      }

      return finalizeEligibleResult(subtotalCents, records)
    }
    case "bundle_price": {
      const benefit = input.promo.benefit as BundlePriceBenefit
      const bundleQuantity = Math.max(0, Math.floor(benefit.bundleQuantity))
      const bundlePriceCents = toCents(Math.max(0, benefit.bundlePrice))

      if (bundleQuantity <= 0) {
        return resultWithReason(
          "This promo has no bundle quantity configured.",
          subtotalCents,
          records
        )
      }

      const bundleCount = Math.floor(qualifyingQuantity / bundleQuantity)
      if (bundleCount <= 0) {
        return resultWithReason(
          "Add more qualifying items to use this promo.",
          subtotalCents,
          records
        )
      }

      const discountedIndexes = sortedIndexesByPrice(
        records,
        qualifyingIndexes,
        "desc"
      ).slice(0, bundleCount * bundleQuantity)
      const discountedBaseCents = discountedIndexes.reduce(
        (total, index) => total + records[index].unitPriceCents,
        0
      )
      const desiredTotalCents = bundleCount * bundlePriceCents

      if (desiredTotalCents >= discountedBaseCents) {
        return resultWithReason(
          "This promo does not reduce the selected items.",
          subtotalCents,
          records
        )
      }

      distributeFixedDiscount(
        records,
        discountedIndexes,
        discountedBaseCents - desiredTotalCents
      )

      return finalizeEligibleResult(subtotalCents, records)
    }
    case "free_item": {
      const benefit = input.promo.benefit as FreeItemBenefit
      const rewardQuantity = Math.max(0, Math.floor(benefit.rewardQuantity))

      if (rewardQuantity <= 0) {
        return resultWithReason(
          "This promo has no free item quantity configured.",
          subtotalCents,
          records
        )
      }

      const rewardUnitIndexes = sortedIndexesByPrice(
        records,
        rewardIndexes,
        "asc"
      ).slice(0, rewardQuantity)

      if (rewardUnitIndexes.length === 0) {
        return resultWithReason(
          "Add the free item to the cart first.",
          subtotalCents,
          records
        )
      }

      for (const index of rewardUnitIndexes) {
        records[index].discountCents = records[index].unitPriceCents
      }

      return finalizeEligibleResult(subtotalCents, records)
    }
  }
}

export function buildPromoApprovalSnapshot(input: {
  promo: CounterPromo
  items: PromoCartItem[]
  paymentMethod: PaymentMethod
  pricing: PromoPricingResult
}) {
  return {
    promo_id: input.promo.id,
    promo_name: input.promo.name,
    promo_type: input.promo.promoType,
    payment_method: input.paymentMethod,
    cart_items: input.items
      .map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        base_unit_price: Number(item.unitPrice.toFixed(2)),
      }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id)),
    subtotal: input.pricing.subtotal,
    promo_discount_total: input.pricing.discountTotal,
    total_amount: input.pricing.total,
  } satisfies PromoApprovalSnapshot
}

export function serializePromoApprovalSnapshot(
  snapshot: PromoApprovalSnapshot
) {
  return JSON.stringify(snapshot)
}

export function isPromoApprovalSnapshotMatch(
  left: PromoApprovalSnapshot,
  right: PromoApprovalSnapshot
) {
  return (
    serializePromoApprovalSnapshot(left) ===
    serializePromoApprovalSnapshot(right)
  )
}

export function getPromoSummary(promo: CounterPromo) {
  switch (promo.promoType) {
    case "percent_off":
      return `${(promo.benefit as PercentOffBenefit).percentOff}% off`
    case "fixed_amount_off":
      return `PHP ${(promo.benefit as FixedAmountOffBenefit).amountOff.toFixed(2)} off`
    case "special_price":
      return `PHP ${(promo.benefit as SpecialPriceBenefit).specialPrice.toFixed(2)} special price`
    case "buy_x_get_y": {
      const benefit = promo.benefit as BuyXGetYBenefit
      return `Buy ${benefit.buyQuantity}, get ${benefit.rewardQuantity}`
    }
    case "bundle_price": {
      const benefit = promo.benefit as BundlePriceBenefit
      return `${benefit.bundleQuantity} for PHP ${benefit.bundlePrice.toFixed(2)}`
    }
    case "free_item":
      return `${(promo.benefit as FreeItemBenefit).rewardQuantity} free item`
  }
}

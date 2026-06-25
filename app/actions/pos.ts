"use server"

import { requireEmployeeRole } from "@/lib/auth"
import type { PaymentMethod } from "@/lib/database.types"
import { getPromoById } from "@/lib/promoData"
import {
  buildPromoApprovalSnapshot,
  evaluatePromoSelection,
  isPromoApprovalSnapshotMatch,
  type CounterPromo,
  type PromoCartItem,
} from "@/lib/promos"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getBusinessDate } from "@/lib/utils"

type CheckoutItemInput = {
  productId: string
  quantity: number
  expectedStock: number
  baseUnitPrice: number
}

type FinalizePosSaleInput = {
  saleId: string
  boothId: string
  scheduleId: string
  paymentMethod: PaymentMethod
  receiptPhotoPath: string | null
  createdAt: string
  items: CheckoutItemInput[]
  promoId?: string | null
  promoApprovalId?: string | null
}

type PromoApprovalInput = {
  scheduleId: string
  paymentMethod: PaymentMethod
  promoId: string
  items: Array<
    Pick<CheckoutItemInput, "productId" | "quantity" | "baseUnitPrice">
  >
}

export type PosActionResult = {
  ok: boolean
  error?: string
  saleId?: string
}

export type PromoApprovalResult = {
  ok: boolean
  error?: string
  approvalId?: string
  status?: "pending" | "approved" | "rejected"
  message?: string
}

type LoadedProduct = {
  id: string
  name: string
  price: number
}

type PreparedCheckout = {
  cartItems: PromoCartItem[]
  expectedStockByProductId: Map<string, number>
  pricing: ReturnType<typeof evaluatePromoSelection>
  promo: CounterPromo | null
  promoSnapshot: ReturnType<typeof buildPromoApprovalSnapshot> | null
}

function normalizeCheckoutItems(items: CheckoutItemInput[]) {
  const grouped = new Map<
    string,
    {
      quantity: number
      expectedStock: number
      baseUnitPrice: number
    }
  >()

  for (const item of items) {
    const existing = grouped.get(item.productId)
    if (existing) {
      existing.quantity += item.quantity
      existing.expectedStock = Math.max(
        existing.expectedStock,
        item.expectedStock
      )
    } else {
      grouped.set(item.productId, {
        quantity: item.quantity,
        expectedStock: item.expectedStock,
        baseUnitPrice: item.baseUnitPrice,
      })
    }
  }

  return Array.from(grouped.entries()).map(([productId, value]) => ({
    productId,
    ...value,
  }))
}

async function loadProducts(productIds: string[]) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price")
    .in("id", productIds)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map<LoadedProduct>((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
  }))
}

function validateBasePrice(currentPrice: number, baseUnitPrice: number) {
  return Math.abs(currentPrice - baseUnitPrice) < 0.005
}

async function prepareCheckout(
  input: Pick<FinalizePosSaleInput, "items" | "paymentMethod" | "promoId">,
  options?: {
    requireExpectedStock?: boolean
  }
): Promise<PreparedCheckout> {
  const normalizedItems = normalizeCheckoutItems(input.items)

  if (normalizedItems.length === 0) {
    throw new Error("SALE_ITEMS_REQUIRED")
  }

  const products = await loadProducts(
    normalizedItems.map((item) => item.productId)
  )
  const productById = new Map(products.map((product) => [product.id, product]))

  if (productById.size !== normalizedItems.length) {
    throw new Error("INVALID_SALE_ITEMS")
  }

  const expectedStockByProductId = new Map<string, number>()
  const cartItems = normalizedItems.map<PromoCartItem>((item) => {
    const product = productById.get(item.productId)

    if (!product) {
      throw new Error("INVALID_SALE_ITEMS")
    }

    if (!validateBasePrice(product.price, item.baseUnitPrice)) {
      throw new Error("PRODUCT_PRICE_STALE")
    }

    if (options?.requireExpectedStock !== false) {
      expectedStockByProductId.set(item.productId, item.expectedStock)
    }

    return {
      productId: item.productId,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
    }
  })

  if (!input.promoId) {
    return {
      cartItems,
      expectedStockByProductId,
      pricing: {
        eligible: true,
        subtotal: Number(
          cartItems
            .reduce((total, item) => total + item.unitPrice * item.quantity, 0)
            .toFixed(2)
        ),
        discountTotal: 0,
        total: Number(
          cartItems
            .reduce((total, item) => total + item.unitPrice * item.quantity, 0)
            .toFixed(2)
        ),
        discountByProductId: {},
        pricedItems: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice.toFixed(2)),
          baseUnitPrice: Number(item.unitPrice.toFixed(2)),
          discountAmount: 0,
        })),
      },
      promo: null,
      promoSnapshot: null,
    }
  }

  const promo = await getPromoById(input.promoId)
  if (!promo) {
    throw new Error("INVALID_PROMO")
  }

  const pricing = evaluatePromoSelection({
    promo,
    items: cartItems,
    businessDate: getBusinessDate(),
    paymentMethod: input.paymentMethod,
  })

  if (!pricing.eligible) {
    throw new Error("PROMO_NOT_ELIGIBLE")
  }

  return {
    cartItems,
    expectedStockByProductId,
    pricing,
    promo,
    promoSnapshot: buildPromoApprovalSnapshot({
      promo,
      items: cartItems,
      paymentMethod: input.paymentMethod,
      pricing,
    }),
  }
}

async function validatePromoApproval(input: {
  approvalId: string
  scheduleId: string
  employeeId: string
  snapshot: NonNullable<PreparedCheckout["promoSnapshot"]>
}) {
  const supabase = createServerSupabaseClient()
  const [
    { data: approval, error: approvalError },
    { data: salePromo, error: salePromoError },
  ] = await Promise.all([
    supabase
      .from("shift_action_approvals")
      .select(
        "id, action_type, status, schedule_id, requested_by_employee_id, payload"
      )
      .eq("id", input.approvalId)
      .maybeSingle(),
    supabase
      .from("sale_promos")
      .select("id")
      .eq("promo_approval_id", input.approvalId)
      .maybeSingle(),
  ])

  if (approvalError) {
    throw new Error(approvalError.message)
  }

  if (salePromoError) {
    throw new Error(salePromoError.message)
  }

  if (salePromo) {
    throw new Error("PROMO_APPROVAL_USED")
  }

  if (
    !approval ||
    approval.action_type !== "apply_promo" ||
    approval.schedule_id !== input.scheduleId ||
    approval.requested_by_employee_id !== input.employeeId
  ) {
    throw new Error("PROMO_APPROVAL_REQUIRED")
  }

  if (approval.status !== "approved") {
    throw new Error(
      approval.status === "rejected"
        ? "PROMO_APPROVAL_REJECTED"
        : "PROMO_APPROVAL_PENDING"
    )
  }

  const payload =
    typeof approval.payload === "object" &&
    approval.payload !== null &&
    !Array.isArray(approval.payload)
      ? approval.payload
      : null

  if (
    !payload ||
    !isPromoApprovalSnapshotMatch(
      payload as ReturnType<typeof buildPromoApprovalSnapshot>,
      input.snapshot
    )
  ) {
    throw new Error("PROMO_APPROVAL_STALE")
  }
}

function mapPosActionError(error: unknown) {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Unable to complete the sale."

  switch (message) {
    case "PRODUCT_PRICE_STALE":
      return "Product pricing changed. Refresh Counter and try again."
    case "PROMO_NOT_ELIGIBLE":
      return "This promo no longer matches the current cart."
    case "INVALID_PROMO":
      return "This promo is no longer available."
    case "PROMO_APPROVAL_REQUIRED":
      return "Admin approval is required before using this promo."
    case "PROMO_APPROVAL_PENDING":
      return "Waiting for admin approval."
    case "PROMO_APPROVAL_REJECTED":
      return "Admin rejected this promo request."
    case "PROMO_APPROVAL_STALE":
      return "The approved promo no longer matches this cart."
    case "PROMO_APPROVAL_USED":
      return "This promo approval was already used."
    default:
      return message
  }
}

export async function finalizePosSale(
  input: FinalizePosSaleInput
): Promise<PosActionResult> {
  const { employee } = await requireEmployeeRole(["employee", "admin"])

  try {
    const prepared = await prepareCheckout(input)

    if (prepared.promo?.requiresAdminApproval && employee.role !== "admin") {
      if (!input.promoApprovalId || !prepared.promoSnapshot) {
        throw new Error("PROMO_APPROVAL_REQUIRED")
      }

      await validatePromoApproval({
        approvalId: input.promoApprovalId,
        scheduleId: input.scheduleId,
        employeeId: employee.id,
        snapshot: prepared.promoSnapshot,
      })
    }

    const supabase = createServerSupabaseClient()
    const { error } = await supabase.rpc("finalize_pos_sale", {
      p_sale_id: input.saleId,
      p_booth_id: input.boothId,
      p_schedule_id: input.scheduleId,
      p_total_amount: prepared.pricing.total,
      p_payment_method: input.paymentMethod,
      p_receipt_photo_path: input.receiptPhotoPath,
      p_created_at: input.createdAt,
      p_items: prepared.pricing.pricedItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        expected_stock: prepared.expectedStockByProductId.get(item.productId),
        base_unit_price: item.baseUnitPrice,
        discount_amount: item.discountAmount,
      })),
      p_promo_id: prepared.promo?.id ?? null,
      p_promo_name: prepared.promo?.name ?? null,
      p_promo_type: prepared.promo?.promoType ?? null,
      p_promo_discount_total: prepared.pricing.discountTotal,
      p_promo_approval_id: input.promoApprovalId ?? null,
      p_promo_snapshot: prepared.promoSnapshot,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { ok: true, saleId: input.saleId }
  } catch (error) {
    return { ok: false, error: mapPosActionError(error) }
  }
}

export async function requestPromoApproval(
  input: PromoApprovalInput
): Promise<PromoApprovalResult> {
  const { employee } = await requireEmployeeRole(["employee", "admin"])

  if (employee.role === "admin") {
    return {
      ok: true,
      status: "approved",
      message: "Admin can apply this promo directly.",
    }
  }

  try {
    const prepared = await prepareCheckout(
      {
        items: input.items.map((item) => ({
          ...item,
          expectedStock: 0,
        })),
        paymentMethod: input.paymentMethod,
        promoId: input.promoId,
      },
      { requireExpectedStock: false }
    )

    if (!prepared.promo) {
      throw new Error("INVALID_PROMO")
    }

    if (!prepared.promo.requiresAdminApproval || !prepared.promoSnapshot) {
      return {
        ok: true,
        status: "approved",
        message: "This promo does not need admin approval.",
      }
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc(
      "request_shift_action_approval",
      {
        p_schedule_id: input.scheduleId,
        p_action_type: "apply_promo",
        p_payload: prepared.promoSnapshot,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    return {
      ok: true,
      approvalId: typeof data === "string" ? data : undefined,
      status: "pending",
      message: "Promo request sent for admin approval.",
    }
  } catch (error) {
    return { ok: false, error: mapPosActionError(error) }
  }
}

export async function getPromoApprovalStatus(
  approvalId: string
): Promise<PromoApprovalResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!approvalId.trim()) {
    return { ok: false, error: "Approval record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("shift_action_approvals")
    .select("id, status")
    .eq("id", approvalId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: false, error: "Approval record is no longer available." }
  }

  return {
    ok: true,
    approvalId: data.id,
    status: data.status,
  }
}

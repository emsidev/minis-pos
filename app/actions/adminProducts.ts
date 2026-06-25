"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import type { AdminProductRecord } from "@/lib/adminProducts"
import { getPromoById } from "@/lib/promoData"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { PROMO_TYPES, type CounterPromo, type PromoType } from "@/lib/promos"
import type { Json, PaymentMethod } from "@/lib/database.types"

export type ProductFormInput = {
  id?: string
  name: string
  price: string
  category: string
  imageUrl: string
  isAvailable: boolean
}

export type ProductAdminActionResult = {
  ok: boolean
  message?: string
  error?: string
  product?: AdminProductRecord
}

export type PromoFormInput = {
  id?: string
  name: string
  promoType: PromoType
  startsOn: string
  endsOn: string
  qualifyingProductIds: string[]
  rewardProductIds: string[]
  minCartSubtotal: string
  minQualifyingQuantity: string
  paymentMethods: PaymentMethod[]
  requiresAdminApproval: boolean
  isActive: boolean
  percentOff: string
  amountOff: string
  specialPrice: string
  buyQuantity: string
  rewardQuantity: string
  bundleQuantity: string
  bundlePrice: string
}

export type PromoAdminActionResult = {
  ok: boolean
  message?: string
  error?: string
  promo?: CounterPromo
}

function revalidateProductRoutes() {
  revalidatePath("/admin/products")
  revalidatePath("/")
  revalidatePath("/shift")
}

function parseNumberInput(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePromoInput(input: PromoFormInput) {
  const name = input.name.trim()

  if (!name) {
    return { error: "Promo name is required." }
  }

  if (!PROMO_TYPES.includes(input.promoType)) {
    return { error: "Choose a valid promo type." }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) {
    return { error: "Start date is required." }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) {
    return { error: "End date is required." }
  }

  if (input.startsOn > input.endsOn) {
    return { error: "End date must be on or after the start date." }
  }

  const qualifyingProductIds = Array.from(
    new Set(
      input.qualifyingProductIds.filter((value) => value.trim().length > 0)
    )
  )
  const rewardProductIds = Array.from(
    new Set(input.rewardProductIds.filter((value) => value.trim().length > 0))
  )

  if (qualifyingProductIds.length === 0) {
    return { error: "Select at least one affected product." }
  }

  const criteria: Record<string, unknown> = {}
  const minCartSubtotal = parseNumberInput(input.minCartSubtotal)
  const minQualifyingQuantity = parseNumberInput(input.minQualifyingQuantity)

  if (minCartSubtotal !== undefined) {
    if (minCartSubtotal < 0) {
      return { error: "Minimum cart subtotal cannot be negative." }
    }
    if (minCartSubtotal > 0) {
      criteria.minCartSubtotal = Number(minCartSubtotal.toFixed(2))
    }
  }

  if (minQualifyingQuantity !== undefined) {
    if (minQualifyingQuantity < 0) {
      return { error: "Minimum qualifying quantity cannot be negative." }
    }
    if (minQualifyingQuantity > 0) {
      criteria.minQualifyingQuantity = Math.floor(minQualifyingQuantity)
    }
  }

  if (input.paymentMethods.length > 0) {
    criteria.paymentMethods = input.paymentMethods
  }

  const benefit: Record<string, unknown> = {}

  switch (input.promoType) {
    case "percent_off": {
      const percentOff = parseNumberInput(input.percentOff)
      if (percentOff === undefined || percentOff <= 0 || percentOff > 100) {
        return { error: "Enter a percent off value between 0 and 100." }
      }
      benefit.percentOff = Number(percentOff.toFixed(2))
      break
    }
    case "fixed_amount_off": {
      const amountOff = parseNumberInput(input.amountOff)
      if (amountOff === undefined || amountOff <= 0) {
        return { error: "Enter a fixed amount off greater than zero." }
      }
      benefit.amountOff = Number(amountOff.toFixed(2))
      break
    }
    case "special_price": {
      const specialPrice = parseNumberInput(input.specialPrice)
      if (specialPrice === undefined || specialPrice < 0) {
        return { error: "Enter a valid special price." }
      }
      benefit.specialPrice = Number(specialPrice.toFixed(2))
      break
    }
    case "buy_x_get_y": {
      const buyQuantity = parseNumberInput(input.buyQuantity)
      const rewardQuantity = parseNumberInput(input.rewardQuantity)

      if (
        buyQuantity === undefined ||
        rewardQuantity === undefined ||
        buyQuantity <= 0 ||
        rewardQuantity <= 0
      ) {
        return { error: "Enter the buy and free quantities for this promo." }
      }

      if (rewardProductIds.length === 0) {
        return { error: "Select at least one reward product." }
      }

      benefit.buyQuantity = Math.floor(buyQuantity)
      benefit.rewardQuantity = Math.floor(rewardQuantity)
      break
    }
    case "bundle_price": {
      const bundleQuantity = parseNumberInput(input.bundleQuantity)
      const bundlePrice = parseNumberInput(input.bundlePrice)

      if (
        bundleQuantity === undefined ||
        bundleQuantity <= 0 ||
        bundlePrice === undefined ||
        bundlePrice < 0
      ) {
        return { error: "Enter the bundle quantity and bundle price." }
      }

      benefit.bundleQuantity = Math.floor(bundleQuantity)
      benefit.bundlePrice = Number(bundlePrice.toFixed(2))
      break
    }
    case "free_item": {
      const rewardQuantity = parseNumberInput(input.rewardQuantity)

      if (rewardQuantity === undefined || rewardQuantity <= 0) {
        return { error: "Enter how many reward items become free." }
      }

      if (rewardProductIds.length === 0) {
        return { error: "Select at least one reward product." }
      }

      benefit.rewardQuantity = Math.floor(rewardQuantity)
      break
    }
  }

  return {
    value: {
      promo: {
        benefit: benefit as Json,
        criteria: criteria as Json,
        ends_on: input.endsOn,
        is_active: input.isActive,
        name,
        promo_type: input.promoType,
        requires_admin_approval: input.requiresAdminApproval,
        starts_on: input.startsOn,
      },
      promoProducts: [
        ...qualifyingProductIds.map((productId) => ({
          product_id: productId,
          role: "qualifying" as const,
        })),
        ...rewardProductIds.map((productId) => ({
          product_id: productId,
          role: "reward" as const,
        })),
      ],
    },
  }
}

function parseProductInput(input: ProductFormInput) {
  const name = input.name.trim()
  const category = input.category.trim()
  const imageUrl = input.imageUrl.trim()
  const price = Number.parseFloat(input.price)

  if (!name) {
    return { error: "Product name is required." }
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: "Enter a valid product price." }
  }

  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl)
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        return { error: "Image URL must be a valid web link." }
      }
    } catch {
      return { error: "Image URL must be a valid web link." }
    }
  }

  return {
    value: {
      category: category || null,
      image_url: imageUrl || null,
      is_available: input.isAvailable,
      name,
      price: price.toFixed(2),
    },
  }
}

export async function saveProduct(
  input: ProductFormInput
): Promise<ProductAdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = parseProductInput(input)
  if (!parsed.value) {
    return { ok: false, error: parsed.error }
  }

  const supabase = createServerSupabaseClient()
  const response = input.id
    ? await supabase
        .from("products")
        .update(parsed.value)
        .eq("id", input.id)
        .select("*")
        .single()
    : await supabase.from("products").insert(parsed.value).select("*").single()

  if (response.error) {
    return { ok: false, error: response.error.message }
  }

  revalidateProductRoutes()
  return {
    ok: true,
    message: input.id ? "Product updated." : "Product created.",
    product: response.data as AdminProductRecord,
  }
}

export async function toggleProductAvailability(
  productId: string,
  isAvailable: boolean
): Promise<ProductAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!productId) {
    return { ok: false, error: "Product record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", productId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateProductRoutes()
  return {
    ok: true,
    message: isAvailable ? "Product marked available." : "Product hidden.",
  }
}

export async function savePromo(
  input: PromoFormInput
): Promise<PromoAdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = parsePromoInput(input)
  if (!parsed.value) {
    return { ok: false, error: parsed.error }
  }

  const supabase = createServerSupabaseClient()
  const promoResponse = input.id
    ? await supabase
        .from("promos")
        .update(parsed.value.promo)
        .eq("id", input.id)
        .select("id")
        .single()
    : await supabase
        .from("promos")
        .insert(parsed.value.promo)
        .select("id")
        .single()

  if (promoResponse.error || !promoResponse.data) {
    return {
      ok: false,
      error: promoResponse.error?.message ?? "Unable to save the promo.",
    }
  }

  const promoId = promoResponse.data.id
  const deleteResponse = await supabase
    .from("promo_products")
    .delete()
    .eq("promo_id", promoId)

  if (deleteResponse.error) {
    return { ok: false, error: deleteResponse.error.message }
  }

  if (parsed.value.promoProducts.length > 0) {
    const insertResponse = await supabase.from("promo_products").insert(
      parsed.value.promoProducts.map((product) => ({
        promo_id: promoId,
        product_id: product.product_id,
        role: product.role,
      }))
    )

    if (insertResponse.error) {
      return { ok: false, error: insertResponse.error.message }
    }
  }

  const savedPromo = await getPromoById(promoId)
  if (!savedPromo) {
    return { ok: false, error: "Promo saved but could not be reloaded." }
  }

  revalidateProductRoutes()
  return {
    ok: true,
    message: input.id ? "Promo updated." : "Promo created.",
    promo: savedPromo,
  }
}

export async function togglePromoActive(
  promoId: string,
  isActive: boolean
): Promise<PromoAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!promoId.trim()) {
    return { ok: false, error: "Promo record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("promos")
    .update({ is_active: isActive })
    .eq("id", promoId)

  if (error) {
    return { ok: false, error: error.message }
  }

  const promo = await getPromoById(promoId)
  revalidateProductRoutes()
  return {
    ok: true,
    message: isActive ? "Promo marked active." : "Promo disabled.",
    promo: promo ?? undefined,
  }
}

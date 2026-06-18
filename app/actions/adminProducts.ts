"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import type { AdminProductRecord } from "@/lib/adminProducts"
import { createServerSupabaseClient } from "@/lib/supabase-server"

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

function revalidateProductRoutes() {
  revalidatePath("/admin/products")
  revalidatePath("/")
  revalidatePath("/shift")
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

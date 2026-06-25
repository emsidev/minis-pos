import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getBusinessDate } from "@/lib/utils"
import { normalizePromoRecord, type CounterPromo } from "@/lib/promos"
import type { Json } from "@/lib/database.types"

type PromoRow = {
  id: string
  name: string
  promo_type:
    | "percent_off"
    | "fixed_amount_off"
    | "special_price"
    | "buy_x_get_y"
    | "bundle_price"
    | "free_item"
  starts_on: string
  ends_on: string
  criteria: Json | null
  benefit: Json | null
  requires_admin_approval: boolean | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  promo_products?: Array<{
    product_id: string
    role: "qualifying" | "reward"
    products?: { name: string } | null
  }> | null
}

async function loadPromos(query: {
  activeOnly?: boolean
  businessDate?: string
}) {
  const supabase = createServerSupabaseClient()
  let request = supabase
    .from("promos")
    .select("*, promo_products(product_id, role, products(name))")
    .order("starts_on", { ascending: false })
    .order("name", { ascending: true })

  if (query.activeOnly) {
    request = request.eq("is_active", true)
  }

  if (query.businessDate) {
    request = request
      .lte("starts_on", query.businessDate)
      .gte("ends_on", query.businessDate)
  }

  const { data, error } = await request

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PromoRow[]
}

export async function getAdminPromos(): Promise<CounterPromo[]> {
  const promos = await loadPromos({})
  return promos.map((promo) => normalizePromoRecord(promo))
}

export async function getActiveCounterPromos(): Promise<CounterPromo[]> {
  const promos = await loadPromos({
    activeOnly: true,
    businessDate: getBusinessDate(),
  })

  return promos.map((promo) => normalizePromoRecord(promo))
}

export async function getPromoById(promoId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("promos")
    .select("*, promo_products(product_id, role, products(name))")
    .eq("id", promoId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return normalizePromoRecord(data as PromoRow)
}

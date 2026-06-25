import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/lib/database.types"
import { getAdminPromos } from "@/lib/promoData"
import type { CounterPromo } from "@/lib/promos"

export type AdminProductRecord = Database["public"]["Tables"]["products"]["Row"]

export async function getAdminProducts() {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data as AdminProductRecord[]
}

export async function getAdminProductsPageData(): Promise<{
  products: AdminProductRecord[]
  promos: CounterPromo[]
}> {
  const [products, promos] = await Promise.all([
    getAdminProducts(),
    getAdminPromos(),
  ])

  return { products, promos }
}

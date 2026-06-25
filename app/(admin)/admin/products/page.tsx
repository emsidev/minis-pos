import { AdminProductsClient } from "@/components/admin/AdminProductsClient"
import { getAdminProductsPageData } from "@/lib/adminProducts"

export default async function AdminProductsPage() {
  const { products, promos } = await getAdminProductsPageData()

  return <AdminProductsClient products={products} promos={promos} />
}

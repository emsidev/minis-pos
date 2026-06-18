import { AdminProductsClient } from "@/components/admin/AdminProductsClient"
import { getAdminProducts } from "@/lib/adminProducts"

export default async function AdminProductsPage() {
  const products = await getAdminProducts()

  return <AdminProductsClient products={products} />
}

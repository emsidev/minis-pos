import { AdminSalesClient } from "@/components/admin/AdminSalesClient"
import {
  getAdminSalesLedger,
  normalizeAdminSalesDateRange,
} from "@/lib/adminSales"

type AdminSalesPageProps = {
  searchParams?: {
    from?: string
    to?: string
  }
}

export default async function AdminSalesPage({
  searchParams,
}: AdminSalesPageProps) {
  const range = normalizeAdminSalesDateRange(
    searchParams?.from,
    searchParams?.to
  )
  const data = await getAdminSalesLedger(range.startDate, range.endDate)

  return <AdminSalesClient data={data} />
}

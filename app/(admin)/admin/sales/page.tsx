import { AdminSalesClient } from "@/components/admin/AdminSalesClient"
import {
  getAdminSalesLedger,
  normalizeAdminSalesDateRange,
} from "@/lib/adminSales"

type AdminSalesPageProps = {
  searchParams?: Promise<{
    from?: string
    to?: string
  }>
}

export default async function AdminSalesPage({
  searchParams,
}: AdminSalesPageProps) {
  const resolvedSearchParams = await searchParams
  const range = normalizeAdminSalesDateRange(
    resolvedSearchParams?.from,
    resolvedSearchParams?.to
  )
  const data = await getAdminSalesLedger(range.startDate, range.endDate)

  return <AdminSalesClient data={data} />
}

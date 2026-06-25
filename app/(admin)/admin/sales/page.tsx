import { AdminSalesClient } from "@/components/admin/AdminSalesClient"
import {
  getAdminSalesLedger,
  normalizeAdminSalesDateRange,
  normalizeAdminSalesView,
} from "@/lib/adminSales"

type AdminSalesPageProps = {
  searchParams?: Promise<{
    from?: string
    to?: string
    view?: string
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
  const data = await getAdminSalesLedger(
    range.startDate,
    range.endDate,
    undefined,
    normalizeAdminSalesView(resolvedSearchParams?.view)
  )

  return <AdminSalesClient data={data} />
}

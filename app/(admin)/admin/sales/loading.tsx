import {
  AdminKpiSkeletonGrid,
  DataTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminSalesLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <AdminKpiSkeletonGrid />
      <Card>
        <CardHeader>
          <CardTitle>Sales Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTableSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  )
}

import {
  AdminKpiSkeletonGrid,
  DataTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboardLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <AdminKpiSkeletonGrid />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTableSkeleton rows={5} showToolbar={false} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Booth Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTableSkeleton rows={6} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

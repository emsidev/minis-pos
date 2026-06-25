import {
  AdminKpiSkeletonGrid,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminApprovalsLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <AdminKpiSkeletonGrid />
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 h-40 animate-pulse rounded-[var(--radius)]" />
          <div className="bg-muted/50 h-40 animate-pulse rounded-[var(--radius)]" />
        </CardContent>
      </Card>
    </div>
  )
}

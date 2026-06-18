import {
  AdminBoothCardsSkeleton,
  CalendarSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminBoothsLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <AdminBoothCardsSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Unified Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}

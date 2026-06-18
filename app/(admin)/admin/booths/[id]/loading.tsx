import {
  AdminBoothCardsSkeleton,
  CalendarSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminBoothDetailLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Booth Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarSkeleton />
        </CardContent>
      </Card>
      <AdminBoothCardsSkeleton />
    </div>
  )
}

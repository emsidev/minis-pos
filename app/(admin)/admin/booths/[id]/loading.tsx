import {
  AdminBoothCardsSkeleton,
  BackLinkSkeleton,
  CalendarSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminBoothDetailLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <BackLinkSkeleton />
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Booth Schedule</CardTitle>
          <CardDescription>Loading booth shifts.</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarSkeleton />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Shifts</CardTitle>
          <CardDescription>Loading shift cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminBoothCardsSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}

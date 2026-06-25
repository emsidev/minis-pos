import {
  BackLinkSkeleton,
  DataTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminBulkScheduleLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <BackLinkSkeleton />
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Generate Draft Rows</CardTitle>
          <CardDescription>
            Preparing the date range controls for bulk draft generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_auto]">
          <div className="space-y-3">
            <div className="bg-muted h-3 w-24 rounded-full" />
            <div className="bg-muted/70 h-11 rounded-[calc(var(--radius)-0.25rem)]" />
            <div className="bg-muted/60 h-4 w-72 max-w-full rounded-full" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="bg-muted/70 h-11 w-28 rounded-full" />
            <div className="bg-muted h-11 w-36 rounded-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mass Apply</CardTitle>
          <CardDescription>
            Loading the shared table and row-edit tools for bulk updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTableSkeleton rows={6} />
        </CardContent>
      </Card>
    </div>
  )
}

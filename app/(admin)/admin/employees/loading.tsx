import {
  DataTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminEmployeesLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Team Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTableSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  )
}

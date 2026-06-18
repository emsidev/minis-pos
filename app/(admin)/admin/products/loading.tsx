import {
  DataTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminProductsLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTableSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  )
}

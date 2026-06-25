import {
  LoadingBanner,
  ShiftDetailSkeleton,
} from "@/components/shared/LoadingSkeletons"

export default function ShiftDetailsLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <LoadingBanner label="Loading shift..." />
      <ShiftDetailSkeleton />
    </div>
  )
}

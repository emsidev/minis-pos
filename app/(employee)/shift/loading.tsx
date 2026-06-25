import {
  LoadingBanner,
  ShiftDetailSkeleton,
  ShiftListSkeleton,
} from "@/components/shared/LoadingSkeletons"

export default function ActiveShiftLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <LoadingBanner label="Loading active shift..." />
      <ShiftListSkeleton />
      <ShiftDetailSkeleton />
    </div>
  )
}

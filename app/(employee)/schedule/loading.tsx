import {
  CalendarSkeleton,
  LoadingBanner,
} from "@/components/shared/LoadingSkeletons"

export default function ScheduleLoading() {
  return (
    <div className="app-page flex flex-col gap-6">
      <LoadingBanner label="Loading schedule..." />
      <CalendarSkeleton />
    </div>
  )
}

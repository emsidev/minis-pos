import { CalendarSkeleton } from "@/components/shared/LoadingSkeletons"

export default function ScheduleLoading() {
  return (
    <div className="app-page">
      <CalendarSkeleton />
    </div>
  )
}

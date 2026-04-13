import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function EmployeeSchedulePage() {
  return (
    <PlaceholderPanel
      eyebrow="Milestone 4 placeholder"
      title="Schedule calendar lands in a later milestone"
      description="This route is wired into the employee shell today so the protected navigation is complete, even though the calendar feature itself is still ahead."
      bullets={[
        "Milestone 4 will render a monthly calendar from booth_schedules.",
        "The active shift badge and Maps link will appear in the shared employee header once scheduling is implemented.",
        "Role protection is already in place, so only employee accounts can load this page.",
      ]}
    />
  )
}

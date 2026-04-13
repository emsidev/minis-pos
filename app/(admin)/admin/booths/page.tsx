import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function AdminBoothsPage() {
  return (
    <PlaceholderPanel
      eyebrow="Milestone 6 placeholder"
      title="Booth management and scheduling will be added here"
      description="This route will later handle booth records, maps links, and the unified scheduling calendar, but it already benefits from admin-only access control."
      bullets={[
        "Milestone 6 will add booth CRUD and employee shift assignment.",
        "Conflict checking will happen in the UI before database insert attempts.",
        "The current placeholder keeps the milestone focused on auth and routing only.",
      ]}
    />
  )
}

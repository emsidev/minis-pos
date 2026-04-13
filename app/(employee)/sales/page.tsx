import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function EmployeeSalesPage() {
  return (
    <PlaceholderPanel
      eyebrow="Milestone 5 placeholder"
      title="Sales history will appear here"
      description="This protected route is ready for the employee-only sales list, filters, and expandable receipt details planned later in the roadmap."
      bullets={[
        "The page is already guarded so employees only see their own area of the app.",
        "Milestone 5 will populate this screen with date filters, sync badges, and sale detail expansion.",
        "The shell is shared with the cashier view so navigation already works end-to-end.",
      ]}
    />
  )
}

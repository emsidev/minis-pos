import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function AdminDashboardPage() {
  return (
    <>
      <PlaceholderPanel
        eyebrow="Milestone 1 foundation"
        title="Admin routing is already live"
        description="Admins are redirected here immediately after login, while employee accounts are sent back to the cashier shell."
        bullets={[
          "The callback route resolves the signed-in employee role after magic-link login.",
          "The admin shell exposes the future management sections without building those milestone features early.",
          "Unauthorized visits to admin routes are redirected back to the correct employee destination.",
        ]}
      />
      <PlaceholderPanel
        eyebrow="Milestone 8 preview"
        title="Sales reporting arrives later"
        description="This page will become the live dashboard for total sales, booth performance, and payment method breakdowns once those milestones are underway."
        bullets={[
          "Per-booth revenue cards and date filters are planned for Milestone 8.",
          "Realtime subscriptions will also land in Milestone 8, after the core sales flow exists.",
          "Today this page acts as the verified landing route for admin users.",
        ]}
      />
    </>
  )
}

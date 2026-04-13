import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function AdminProductsPage() {
  return (
    <PlaceholderPanel
      eyebrow="Milestone 8 placeholder"
      title="Product catalog management starts here later"
      description="The protected route is ready, but the actual product list, availability toggle, and create/edit flows stay parked until the dashboard milestone."
      bullets={[
        "Admins can already reach this route from the shared shell.",
        "Milestone 8 will add realtime-friendly product management tied to Supabase.",
        "Keeping the route in place now makes the role-based app map complete for Milestone 1.",
      ]}
    />
  )
}

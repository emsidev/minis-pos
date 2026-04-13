import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function AdminEmployeesPage() {
  return (
    <PlaceholderPanel
      eyebrow="Milestone 7 placeholder"
      title="Employee management is reserved for a later milestone"
      description="The admin shell already reserves space for invites, role changes, and activation controls without leaking those features into Milestone 1."
      bullets={[
        "Milestone 7 will add employee invites using Supabase magic links.",
        "Role and active-state changes will be managed here by admins only.",
        "The route exists now so the full protected admin navigation can be verified end-to-end.",
      ]}
    />
  )
}

import { PlaceholderPanel } from "@/components/shared/PlaceholderPanel"

export default function EmployeeHomePage() {
  return (
    <>
      <PlaceholderPanel
        eyebrow="Milestone 2 preview"
        title="POS register comes next"
        description="The cashier workspace will live here once the online product grid, cart, and payment capture flow are added in the next milestone."
        bullets={[
          "Products will load from Supabase and be grouped by category.",
          "The cart will support quantity changes, payment method selection, and the non-cash receipt photo rule.",
          "The header will eventually show the active booth and sync status once later milestones land.",
        ]}
      />
      <PlaceholderPanel
        eyebrow="Foundation complete"
        title="Employee access is already role-protected"
        description="Only authenticated users with the employee role can reach this shell. Admin accounts are redirected back to the admin dashboard automatically."
        bullets={[
          "Unauthenticated visitors are redirected to /login by middleware.",
          "The login callback creates a default employee profile the first time a user signs in.",
          "Future employee pages now inherit a consistent shell and sign-out flow.",
        ]}
      />
    </>
  )
}

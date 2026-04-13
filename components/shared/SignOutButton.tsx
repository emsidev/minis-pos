import { signOutAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  )
}

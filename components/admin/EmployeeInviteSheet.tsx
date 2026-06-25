"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Copy, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import {
  inviteEmployee,
  type EmployeeInviteInput,
} from "@/app/actions/adminEmployees"
import { EmployeeProfileFields } from "@/components/admin/EmployeeProfileFields"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import {
  extractOptimisticRollback,
  type OptimisticMutationHandler,
} from "@/lib/optimistic"

type EmployeeInviteSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (employee: AdminEmployeeRecord) => void
  onOptimisticSave?: OptimisticMutationHandler<EmployeeInviteInput>
}

const blankForm: EmployeeInviteInput = {
  name: "",
  email: "",
  role: "employee",
}

export function EmployeeInviteSheet({
  open,
  onOpenChange,
  onSaved,
  onOptimisticSave,
}: EmployeeInviteSheetProps) {
  const [form, setForm] = useState<EmployeeInviteInput>(blankForm)
  const [inviteLink, setInviteLink] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(blankForm)
      setInviteLink("")
    }
  }, [open])

  const setValue = (field: keyof EmployeeInviteInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Invite link copied.")
    } catch {
      toast.info("Invite link is ready below.")
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const rollback = extractOptimisticRollback(onOptimisticSave?.(form))
    setPending(true)

    const result = await inviteEmployee(form)
    setPending(false)

    if (!result.ok) {
      if (result.employee) {
        onSaved(result.employee)
        toast.error(
          result.error ??
            "Employee saved, but the invite could not be delivered yet."
        )
        onOpenChange(false)
        return
      }

      rollback?.()
      toast.error(result.error ?? "Unable to send the invite.")
      return
    }

    if (result.inviteLink) {
      setInviteLink(result.inviteLink)
      await copyInviteLink(result.inviteLink)
    } else {
      setInviteLink("")
    }

    toast.success(result.message)
    if (result.employee) {
      onSaved(result.employee)
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>Invite Employee</SheetTitle>
          <SheetDescription>
            Create the employee record, choose their access level, and send the
            first sign-in email.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="employee-invite-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <EmployeeProfileFields
              name={form.name}
              email={form.email}
              role={form.role}
              disabled={pending}
              emailDescription="The employee will receive a password setup email."
              onNameChange={(value) => setValue("name", value)}
              onEmailChange={(value) => setValue("email", value)}
              onRoleChange={(value) =>
                setForm((current) => ({ ...current, role: value }))
              }
            />
            {inviteLink ? (
              <Field>
                <FieldLabel htmlFor="invite-link">Manual setup link</FieldLabel>
                <div className="flex gap-2">
                  <Input id="invite-link" readOnly value={inviteLink} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyInviteLink(inviteLink)}
                  >
                    <Copy data-icon="inline-start" />
                    Copy
                  </Button>
                </div>
                <FieldDescription>
                  Share this only if email delivery fails.
                </FieldDescription>
              </Field>
            ) : null}
          </form>
        </div>
        <footer className="border-border flex shrink-0 justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="employee-invite-form" disabled={pending}>
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            Send Invite
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

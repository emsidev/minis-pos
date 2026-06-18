"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Copy, Loader2, Mail, Shield, UserRound } from "lucide-react"
import { toast } from "sonner"

import {
  inviteEmployee,
  type EmployeeInviteInput,
} from "@/app/actions/adminEmployees"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import type { EmployeeRole } from "@/lib/database.types"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type EmployeeInviteSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  magicLinkEnabled: boolean
  onSaved: (employee: AdminEmployeeRecord) => void
}

const blankForm: EmployeeInviteInput = {
  name: "",
  email: "",
  role: "employee",
}

function RoleButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof UserRound
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn(
        "justify-start",
        !active && "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  )
}

export function EmployeeInviteSheet({
  open,
  onOpenChange,
  magicLinkEnabled,
  onSaved,
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

  const setRole = (role: EmployeeRole) => {
    setForm((current) => ({ ...current, role }))
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
    setPending(true)

    const result = await inviteEmployee(form)
    setPending(false)

    if (!result.ok) {
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
    if (magicLinkEnabled) {
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col p-0"
      >
        <div className="shrink-0 border-b border-border px-6 pb-5 pt-6">
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
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-name">Employee name</FieldLabel>
                <Input
                  id="invite-name"
                  required
                  value={form.name}
                  onChange={(event) => setValue("name", event.target.value)}
                  placeholder="Ana Santos"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
                <Input
                  id="invite-email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setValue("email", event.target.value)}
                  placeholder="ana@minis-pastries.com"
                />
                <FieldDescription>
                  {magicLinkEnabled
                    ? "The employee will receive a sign-in link."
                    : "The employee will receive a password setup email and a backup setup link will be prepared here."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  <RoleButton
                    active={form.role === "employee"}
                    icon={UserRound}
                    label="Employee"
                    onClick={() => setRole("employee")}
                  />
                  <RoleButton
                    active={form.role === "admin"}
                    icon={Shield}
                    label="Admin"
                    onClick={() => setRole("admin")}
                  />
                </div>
              </Field>
              {inviteLink ? (
                <Field>
                  <FieldLabel htmlFor="invite-link">
                    Backup access link
                  </FieldLabel>
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
                    Keep this as a fallback if the employee does not receive the
                    email immediately.
                  </FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>
          </form>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
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

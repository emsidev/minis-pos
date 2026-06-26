"use client"

import { useEffect, useState, type FormEvent } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  updateEmployeePassword,
  type EmployeePasswordInput,
} from "@/app/actions/adminEmployees"
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
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"

const blankForm: EmployeePasswordInput = {
  employeeId: "",
  password: "",
  confirmPassword: "",
}

type EmployeePasswordSheetProps = {
  employee: AdminEmployeeRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (employee: AdminEmployeeRecord) => void
}

export function EmployeePasswordSheet({
  employee,
  open,
  onOpenChange,
  onSaved,
}: EmployeePasswordSheetProps) {
  const [form, setForm] = useState<EmployeePasswordInput>(blankForm)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open || !employee) {
      return
    }

    setForm({
      employeeId: employee.id,
      password: "",
      confirmPassword: "",
    })
  }, [employee, open])

  const setValue = (field: keyof EmployeePasswordInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)

    const result = await updateEmployeePassword(form)
    setPending(false)

    if (!result.ok || !result.employee) {
      toast.error(result.error ?? "Unable to update this password.")
      return
    }

    toast.success(result.message)
    onSaved(result.employee)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="app-sheet-content max-w-xl"
      >
        <div className="app-sheet-header">
          <SheetTitle>Set Employee Password</SheetTitle>
          <SheetDescription>
            Set or replace the sign-in password for {employee?.name ?? "this employee"}.
            Pending accounts still need admin approval before access is allowed.
          </SheetDescription>
        </div>
        <div className="app-sheet-body">
          <form
            id="employee-password-form"
            className="app-sheet-form"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="employee-password">New password</FieldLabel>
                <Input
                  id="employee-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.password}
                  disabled={pending}
                  onChange={(event) => setValue("password", event.target.value)}
                />
                <FieldDescription>
                  The password must be at least 6 characters.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="employee-confirm-password">
                  Confirm password
                </FieldLabel>
                <Input
                  id="employee-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.confirmPassword}
                  disabled={pending}
                  onChange={(event) =>
                    setValue("confirmPassword", event.target.value)
                  }
                />
              </Field>
            </FieldGroup>
          </form>
        </div>
        <footer className="app-sheet-footer">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="employee-password-form"
            className="w-full sm:w-auto"
            disabled={pending}
          >
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <KeyRound data-icon="inline-start" />
            )}
            Save Password
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

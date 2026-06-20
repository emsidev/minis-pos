"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"

import {
  updateEmployeeDetails,
  type EmployeeUpdateInput,
} from "@/app/actions/adminEmployees"
import { EmployeeProfileFields } from "@/components/admin/EmployeeProfileFields"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"

type EmployeeEditSheetProps = {
  employee: AdminEmployeeRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (employee: AdminEmployeeRecord) => void
}

const blankForm: EmployeeUpdateInput = {
  id: "",
  name: "",
  email: "",
  role: "employee",
  isActive: true,
}

export function EmployeeEditSheet({
  employee,
  open,
  onOpenChange,
  onSaved,
}: EmployeeEditSheetProps) {
  const [form, setForm] = useState<EmployeeUpdateInput>(blankForm)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open || !employee) {
      return
    }

    setForm({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role === "admin" ? "admin" : "employee",
      isActive: employee.is_active !== false,
    })
  }, [employee, open])

  const setValue = <Field extends keyof EmployeeUpdateInput>(
    field: Field,
    value: EmployeeUpdateInput[Field]
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)

    const result = await updateEmployeeDetails(form)
    setPending(false)

    if (!result.ok || !result.employee) {
      toast.error(result.error ?? "Unable to update this user.")
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
        className="flex h-full w-full max-w-xl flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>
            Update the employee profile, sign-in email, access level, and
            current account status.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="employee-edit-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <EmployeeProfileFields
              name={form.name}
              email={form.email}
              role={form.role}
              isActive={form.isActive}
              disabled={pending}
              emailDescription="Use the same email the employee should use for future sign-ins and invite emails."
              onNameChange={(value) => setValue("name", value)}
              onEmailChange={(value) => setValue("email", value)}
              onRoleChange={(value) => setValue("role", value)}
              onActiveChange={(value) => setValue("isActive", value)}
            />
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
          <Button type="submit" form="employee-edit-form" disabled={pending}>
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Pencil data-icon="inline-start" />
            )}
            Save Changes
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

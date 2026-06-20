"use client"

import { Shield, UserCheck, UserRound, UserX } from "lucide-react"

import type { EmployeeRole } from "@/lib/database.types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type RoleButtonProps = {
  active: boolean
  disabled?: boolean
  icon: typeof UserRound
  label: string
  onClick: () => void
}

function OptionButton({
  active,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: RoleButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn(
        "justify-start",
        !active && "text-muted-foreground hover:text-foreground"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  )
}

type EmployeeProfileFieldsProps = {
  name: string
  email: string
  role: EmployeeRole
  isActive?: boolean
  disabled?: boolean
  emailDescription?: string
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onRoleChange: (role: EmployeeRole) => void
  onActiveChange?: (isActive: boolean) => void
}

export function EmployeeProfileFields({
  name,
  email,
  role,
  isActive,
  disabled = false,
  emailDescription,
  onNameChange,
  onEmailChange,
  onRoleChange,
  onActiveChange,
}: EmployeeProfileFieldsProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="employee-name">Employee name</FieldLabel>
        <Input
          id="employee-name"
          required
          value={name}
          disabled={disabled}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ana Santos"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="employee-email">Email address</FieldLabel>
        <Input
          id="employee-email"
          required
          type="email"
          value={email}
          disabled={disabled}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="ana@minis-pastries.com"
        />
        {emailDescription ? (
          <FieldDescription>{emailDescription}</FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel>Role</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionButton
            active={role === "employee"}
            disabled={disabled}
            icon={UserRound}
            label="Employee"
            onClick={() => onRoleChange("employee")}
          />
          <OptionButton
            active={role === "admin"}
            disabled={disabled}
            icon={Shield}
            label="Admin"
            onClick={() => onRoleChange("admin")}
          />
        </div>
      </Field>
      {typeof isActive === "boolean" && onActiveChange ? (
        <Field>
          <FieldLabel>Status</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <OptionButton
              active={isActive}
              disabled={disabled}
              icon={UserCheck}
              label="Active"
              onClick={() => onActiveChange(true)}
            />
            <OptionButton
              active={!isActive}
              disabled={disabled}
              icon={UserX}
              label="Inactive"
              onClick={() => onActiveChange(false)}
            />
          </div>
          <FieldDescription>
            Inactive users stay in history but cannot sign in or receive new
            shift assignments.
          </FieldDescription>
        </Field>
      ) : null}
    </FieldGroup>
  )
}

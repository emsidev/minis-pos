"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Ellipsis,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Shield,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react"
import { toast } from "sonner"

import {
  approveEmployee,
  resendEmployeeInvite,
  type EmployeeInviteInput,
  type EmployeeUpdateInput,
  updateEmployeeRole,
  updateEmployeeStatus,
} from "@/app/actions/adminEmployees"
import { buildOptimisticEmployeeRecord } from "@/lib/adminOptimistic"
import { EmployeeEditSheet } from "@/components/admin/EmployeeEditSheet"
import { EmployeeInviteSheet } from "@/components/admin/EmployeeInviteSheet"
import { EmployeePasswordSheet } from "@/components/admin/EmployeePasswordSheet"
import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import { isEmployeePendingApproval } from "@/lib/employeeApproval"

type AdminEmployeesClientProps = {
  employees: AdminEmployeeRecord[]
}

function sortEmployees(rows: AdminEmployeeRecord[]) {
  return rows.slice().sort((left, right) => {
    const leftPending = isEmployeePendingApproval(left)
    const rightPending = isEmployeePendingApproval(right)

    if (leftPending !== rightPending) {
      return leftPending ? -1 : 1
    }

    if ((left.is_active ?? true) !== (right.is_active ?? true)) {
      return left.is_active === false ? 1 : -1
    }

    return left.name.localeCompare(right.name)
  })
}

export function AdminEmployeesClient({ employees }: AdminEmployeesClientProps) {
  const [displayEmployees, setDisplayEmployees] = useState(employees)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] =
    useState<AdminEmployeeRecord | null>(null)
  const [passwordEmployee, setPasswordEmployee] =
    useState<AdminEmployeeRecord | null>(null)
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(
    null
  )
  const optimisticEmployeeIdRef = useRef<string | null>(null)

  useEffect(() => {
    setDisplayEmployees(employees)
  }, [employees])

  const handleOptimisticInvite = useCallback(
    (input: EmployeeInviteInput) => {
      const previousEmployees = displayEmployees
      const matchedEmployee = displayEmployees.find(
        (employee) =>
          employee.email.trim().toLowerCase() ===
          input.email.trim().toLowerCase()
      )
      const optimisticId =
        matchedEmployee?.id ?? `optimistic-employee-${crypto.randomUUID()}`

      optimisticEmployeeIdRef.current = matchedEmployee ? null : optimisticId

      const optimisticEmployee = buildOptimisticEmployeeRecord(
        input,
        optimisticId,
        matchedEmployee
      )

      setDisplayEmployees((current) =>
        sortEmployees([
          optimisticEmployee,
          ...current.filter(
            (employee) =>
              employee.id !== optimisticEmployee.id &&
              employee.email.trim().toLowerCase() !== optimisticEmployee.email
          ),
        ])
      )

      return () => {
        optimisticEmployeeIdRef.current = null
        setDisplayEmployees(previousEmployees)
      }
    },
    [displayEmployees]
  )

  const handleOptimisticEdit = useCallback(
    (input: EmployeeUpdateInput) => {
      const previousEmployees = displayEmployees
      const optimisticEmployee = buildOptimisticEmployeeRecord(
        input,
        input.id,
        editingEmployee
      )

      optimisticEmployeeIdRef.current = null
      setDisplayEmployees((current) =>
        sortEmployees(
          current.map((employee) =>
            employee.id === input.id ? optimisticEmployee : employee
          )
        )
      )

      return () => {
        setDisplayEmployees(previousEmployees)
      }
    },
    [displayEmployees, editingEmployee]
  )

  const handleApproveEmployee = useCallback(
    async (employeeId: string) => {
      const previousEmployees = displayEmployees
      setPendingEmployeeId(employeeId)
      setDisplayEmployees((current) =>
        sortEmployees(
          current.map((employee) =>
            employee.id === employeeId
              ? {
                  ...employee,
                  approval_status: "approved",
                  is_active: true,
                }
              : employee
          )
        )
      )

      const result = await approveEmployee(employeeId)
      setPendingEmployeeId(null)

      if (!result.ok) {
        setDisplayEmployees(previousEmployees)
        toast.error(result.error ?? "Unable to approve this employee.")
        return
      }

      if (result.employee) {
        setDisplayEmployees((current) =>
          sortEmployees(
            current.map((employee) =>
              employee.id === result.employee?.id ? result.employee : employee
            )
          )
        )
      }

      toast.success(result.message)
    },
    [displayEmployees]
  )

  const handleRoleChange = useCallback(
    async (employeeId: string, nextRole: "employee" | "admin") => {
      const previousEmployees = displayEmployees
      setPendingEmployeeId(employeeId)
      setDisplayEmployees((current) =>
        current.map((employee) =>
          employee.id === employeeId
            ? { ...employee, role: nextRole }
            : employee
        )
      )

      const result = await updateEmployeeRole(employeeId, nextRole)
      setPendingEmployeeId(null)

      if (!result.ok) {
        setDisplayEmployees(previousEmployees)
        toast.error(result.error ?? "Unable to update the role.")
        return
      }

      toast.success(result.message)
    },
    [displayEmployees]
  )

  const handleStatusChange = useCallback(
    async (employeeId: string, nextStatus: boolean) => {
      const previousEmployees = displayEmployees
      setPendingEmployeeId(employeeId)
      setDisplayEmployees((current) =>
        sortEmployees(
          current.map((employee) =>
            employee.id === employeeId
              ? {
                  ...employee,
                  approval_status: nextStatus
                    ? "approved"
                    : employee.approval_status,
                  is_active: nextStatus,
                }
              : employee
          )
        )
      )

      const result = await updateEmployeeStatus(employeeId, nextStatus)
      setPendingEmployeeId(null)

      if (!result.ok) {
        setDisplayEmployees(previousEmployees)
        toast.error(result.error ?? "Unable to update the employee status.")
        return
      }

      toast.success(result.message)
    },
    [displayEmployees]
  )

  const handleResendInvite = useCallback(
    async (employee: AdminEmployeeRecord) => {
      setPendingEmployeeId(employee.id)
      const result = await resendEmployeeInvite(employee.id)
      setPendingEmployeeId(null)

      if (!result.ok) {
        toast.error(result.error ?? "Unable to resend the invite email.")
        return
      }

      if (result.inviteLink) {
        try {
          await navigator.clipboard.writeText(result.inviteLink)
          toast.success(`${result.message} Manual link copied.`)
          return
        } catch {
          // Fall back to the server-action message if clipboard access fails.
        }
      }

      toast.success(result.message)
    },
    []
  )

  const columns = useMemo<ColumnDef<AdminEmployeeRecord>[]>
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employee" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {row.original.name}
            </span>
            <span className="text-muted-foreground text-sm">
              {row.original.email}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const isAdmin = row.original.role === "admin"

          return (
            <Badge variant={isAdmin ? "secondary" : "outline"}>
              {isAdmin ? "Admin" : "Employee"}
            </Badge>
          )
        },
      },
      {
        id: "status",
        accessorFn: (row) =>
          isEmployeePendingApproval(row)
            ? "pending approval"
            : row.is_active === false
              ? "inactive"
              : "active",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          if (isEmployeePendingApproval(row.original)) {
            return <Badge variant="outline">Pending approval</Badge>
          }

          return (
            <Badge
              variant={row.original.is_active === false ? "outline" : "default"}
            >
              {row.original.is_active === false ? "Inactive" : "Active"}
            </Badge>
          )
        },
      },
      {
        id: "access",
        accessorFn: (row) =>
          isEmployeePendingApproval(row)
            ? "waiting approval"
            : row.user_id
              ? "ready"
              : "pending",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Access" />
        ),
        cell: ({ row }) => {
          if (isEmployeePendingApproval(row.original)) {
            return <Badge variant="outline">Waiting approval</Badge>
          }

          return (
            <Badge variant={row.original.user_id ? "secondary" : "outline"}>
              {row.original.user_id ? "Ready to sign in" : "Pending login"}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const employee = row.original
          const pending = pendingEmployeeId === employee.id
          const isAdmin = employee.role === "admin"
          const isActive = employee.is_active !== false
          const pendingApproval = isEmployeePendingApproval(employee)
          const canResendInvite = !pendingApproval && isActive && !employee.user_id

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                >
                  <Ellipsis />
                  <span className="sr-only">Open employee actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => setEditingEmployee(employee)}
                  >
                    <Pencil data-icon="inline-start" />
                    Edit User
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => setPasswordEmployee(employee)}
                  >
                    <KeyRound data-icon="inline-start" />
                    Set Password
                  </DropdownMenuItem>
                  {pendingApproval ? (
                    <DropdownMenuItem
                      disabled={pending}
                      onClick={() => handleApproveEmployee(employee.id)}
                    >
                      {pending ? (
                        <Loader2
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <ShieldCheck data-icon="inline-start" />
                      )}
                      Approve Account
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    disabled={pending || !canResendInvite}
                    onClick={() => handleResendInvite(employee)}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <Mail data-icon="inline-start" />
                    )}
                    Resend Invite Email
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending || isAdmin}
                    onClick={() => handleRoleChange(employee.id, "admin")}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <Shield data-icon="inline-start" />
                    )}
                    Make Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending || !isAdmin}
                    onClick={() => handleRoleChange(employee.id, "employee")}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <UserRound data-icon="inline-start" />
                    )}
                    Make Employee
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending || pendingApproval}
                    onClick={() => handleStatusChange(employee.id, !isActive)}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : isActive ? (
                      <UserX data-icon="inline-start" />
                    ) : (
                      <UserCheck data-icon="inline-start" />
                    )}
                    {isActive ? "Disable User" : "Enable User"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [
      handleApproveEmployee,
      handleResendInvite,
      handleRoleChange,
      handleStatusChange,
      pendingEmployeeId,
    ]
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Employee Management</h1>
          <p className="app-screen-description">
            Invite staff and manage access.
          </p>
        </div>
        <Button type="button" size="lg" onClick={() => setInviteOpen(true)}>
          <Mail data-icon="inline-start" />
          Invite Employee
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Team Directory</CardTitle>
          <CardDescription>
            Search by employee name, email, role, status, or approval state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={displayEmployees}
            searchPlaceholder="Search employees"
            getSearchText={(row) =>
              [
                row.name,
                row.email,
                row.role,
                isEmployeePendingApproval(row)
                  ? "pending approval for approval approve"
                  : row.is_active === false
                    ? "inactive"
                    : "active",
                row.user_id ? "ready to sign in" : "pending login",
              ].join(" ")
            }
            emptyMessage="No employees match the current search."
            initialSorting={[{ id: "name", desc: false }]}
          />
        </CardContent>
      </Card>

      <EmployeeInviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onOptimisticSave={handleOptimisticInvite}
        onSaved={(employee) => {
          const optimisticId = optimisticEmployeeIdRef.current
          optimisticEmployeeIdRef.current = null
          setDisplayEmployees((current) =>
            sortEmployees([
              employee,
              ...current.filter(
                (entry) => entry.id !== employee.id && entry.id !== optimisticId
              ),
            ])
          )
        }}
      />
      <EmployeeEditSheet
        employee={editingEmployee}
        open={Boolean(editingEmployee)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEmployee(null)
          }
        }}
        onOptimisticSave={handleOptimisticEdit}
        onSaved={(employee) => {
          setDisplayEmployees((current) =>
            sortEmployees(
              current.map((entry) =>
                entry.id === employee.id ? employee : entry
              )
            )
          )
        }}
      />
      <EmployeePasswordSheet
        employee={passwordEmployee}
        open={Boolean(passwordEmployee)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordEmployee(null)
          }
        }}
        onSaved={(employee) => {
          setDisplayEmployees((current) =>
            sortEmployees(
              current.map((entry) =>
                entry.id === employee.id ? employee : entry
              )
            )
          )
        }}
      />
    </div>
  )
}

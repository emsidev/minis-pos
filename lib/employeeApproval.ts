export type EmployeeApprovalStatus = "pending" | "approved"

export type EmployeeApprovalFields = {
  approval_status?: string | null
}

export function getEmployeeApprovalStatus(
  employee: EmployeeApprovalFields | null | undefined
): EmployeeApprovalStatus {
  return employee?.approval_status === "pending" ? "pending" : "approved"
}

export function isEmployeePendingApproval(
  employee: EmployeeApprovalFields | null | undefined
) {
  return getEmployeeApprovalStatus(employee) === "pending"
}

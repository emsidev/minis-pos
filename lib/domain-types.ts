export const EMPLOYEE_ROLES = ["employee", "admin"] as const
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]

export const SCHEDULE_STATUSES = ["scheduled", "closed", "cancelled"] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export const INVENTORY_EVENT_TYPES = [
  "opening",
  "adjustment",
  "admin_override",
  "closeout",
] as const
export type InventoryEventType = (typeof INVENTORY_EVENT_TYPES)[number]

export const PAYMENT_METHODS = [
  "cash",
  "gcash",
  "maya",
  "maribank",
  "unionbank",
  "other",
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

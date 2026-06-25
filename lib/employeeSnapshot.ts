import { createHmac, timingSafeEqual } from "node:crypto"

import type { Database } from "@/lib/database.types"
import type { EmployeeRole } from "@/lib/domain-types"

type EmployeeRecord = Database["public"]["Tables"]["employees"]["Row"]

type CookieSetter = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean
      secure?: boolean
      sameSite?: "lax" | "strict" | "none"
      path?: string
      maxAge?: number
    }
  ) => unknown
}

export const EMPLOYEE_SNAPSHOT_COOKIE = "mini_pos_employee_snapshot"

const EMPLOYEE_SNAPSHOT_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

export type EmployeeSnapshot = {
  id: string
  user_id: string
  email: string
  name: string
  role: EmployeeRole
  is_active: boolean
  created_at: string | null
  updated_at: string
}

function normalizeRole(role: string | null | undefined): EmployeeRole {
  return role === "admin" ? "admin" : "employee"
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function encodeSnapshot(snapshot: EmployeeSnapshot) {
  return encodeURIComponent(JSON.stringify(snapshot))
}

function getSnapshotSigningKey() {
  return process.env.OFFLINE_SNAPSHOT_SIGNING_KEY?.trim() || null
}

function signSnapshot(payload: string, signingKey: string) {
  return createHmac("sha256", signingKey).update(payload).digest("base64url")
}

export function parseEmployeeSnapshot(
  rawCookieValue: string | undefined
): EmployeeSnapshot | null {
  const signingKey = getSnapshotSigningKey()
  if (!rawCookieValue || !signingKey) {
    return null
  }

  try {
    const separatorIndex = rawCookieValue.lastIndexOf(".")
    if (separatorIndex <= 0 || separatorIndex === rawCookieValue.length - 1) {
      return null
    }

    const payload = rawCookieValue.slice(0, separatorIndex)
    const signature = rawCookieValue.slice(separatorIndex + 1)

    if (!payload || !signature) {
      return null
    }

    const expectedSignature = signSnapshot(payload, signingKey)
    const provided = Buffer.from(signature)
    const expected = Buffer.from(expectedSignature)

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return null
    }

    const parsed = JSON.parse(
      decodeURIComponent(payload)
    ) as Partial<EmployeeSnapshot>

    if (
      !isNonEmptyString(parsed.id) ||
      !isNonEmptyString(parsed.user_id) ||
      !isNonEmptyString(parsed.email) ||
      !isNonEmptyString(parsed.name) ||
      !isNonEmptyString(parsed.updated_at)
    ) {
      return null
    }

    const updatedAt = Date.parse(parsed.updated_at)
    const expiresAt = updatedAt + EMPLOYEE_SNAPSHOT_MAX_AGE_SECONDS * 1000
    if (!Number.isFinite(updatedAt) || Date.now() > expiresAt) {
      return null
    }

    return {
      id: parsed.id,
      user_id: parsed.user_id,
      email: parsed.email,
      name: parsed.name,
      role: normalizeRole(parsed.role),
      is_active: Boolean(parsed.is_active),
      created_at: parsed.created_at ?? null,
      updated_at: parsed.updated_at,
    }
  } catch {
    return null
  }
}

export function employeeSnapshotToRecord(
  snapshot: EmployeeSnapshot
): EmployeeRecord {
  return {
    approval_status: "approved",
    id: snapshot.id,
    user_id: snapshot.user_id,
    email: snapshot.email,
    name: snapshot.name,
    role: snapshot.role,
    is_active: snapshot.is_active,
    created_at: snapshot.created_at,
  }
}

function buildSnapshotFromEmployee(employee: EmployeeRecord): EmployeeSnapshot {
  return {
    id: employee.id,
    user_id: employee.user_id ?? "",
    email: employee.email,
    name: employee.name,
    role: normalizeRole(employee.role),
    is_active: Boolean(employee.is_active),
    created_at: employee.created_at,
    updated_at: new Date().toISOString(),
  }
}

export function writeEmployeeSnapshotCookie(
  cookieStore: CookieSetter,
  employee: EmployeeRecord
) {
  const userId = employee.user_id?.trim()

  if (!userId) {
    return
  }

  const signingKey = getSnapshotSigningKey()
  if (!signingKey) {
    return
  }

  const snapshot = buildSnapshotFromEmployee(employee)
  const payload = encodeSnapshot(snapshot)

  cookieStore.set(
    EMPLOYEE_SNAPSHOT_COOKIE,
    `${payload}.${signSnapshot(payload, signingKey)}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: EMPLOYEE_SNAPSHOT_MAX_AGE_SECONDS,
    }
  )
}

export function clearEmployeeSnapshotCookie(cookieStore: CookieSetter) {
  cookieStore.set(EMPLOYEE_SNAPSHOT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

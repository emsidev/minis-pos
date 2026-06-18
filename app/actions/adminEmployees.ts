"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import type { EmployeeRole } from "@/lib/database.types"
import { isMagicLinkAuthEnabled } from "@/lib/env"
import { isEmployeeRole, normalizeEmployeeEmail } from "@/lib/adminEmployees"
import { getRequestOrigin } from "@/lib/server-utils"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type EmployeeInviteInput = {
  name: string
  email: string
  role: EmployeeRole
}

export type EmployeeAdminActionResult = {
  ok: boolean
  message?: string
  error?: string
  inviteLink?: string
  employee?: AdminEmployeeRecord
}

function revalidateEmployeeAdminRoutes() {
  revalidatePath("/admin/employees")
  revalidatePath("/admin/booths")
}

function validateInviteInput(input: EmployeeInviteInput) {
  const name = input.name.trim()
  const email = normalizeEmployeeEmail(input.email)
  const role = input.role

  if (!name) {
    return { error: "Employee name is required." }
  }

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." }
  }

  if (!isEmployeeRole(role)) {
    return { error: "Select a valid role." }
  }

  return {
    name,
    email,
    role,
  }
}

async function findAuthUserByEmail(email: string) {
  const adminSupabase = createAdminSupabaseClient()
  let page = 1

  while (page <= 5) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new Error(error.message)
    }

    const users = data?.users ?? []
    const matchedUser = users.find(
      (user) => user.email?.trim().toLowerCase() === email
    )
    if (matchedUser) {
      return matchedUser
    }

    if (users.length < 200) {
      break
    }

    page += 1
  }

  return null
}

export async function inviteEmployee(
  input: EmployeeInviteInput
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = validateInviteInput(input)
  if ("error" in parsed) {
    return { ok: false, error: parsed.error }
  }

  const { name, email, role } = parsed
  const origin = getRequestOrigin()
  const supabase = createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()

  const { data: existingEmployee, error: employeeLookupError } = await supabase
    .from("employees")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (employeeLookupError) {
    return { ok: false, error: employeeLookupError.message }
  }

  const employeeRow = existingEmployee
    ? await supabase
        .from("employees")
        .update({
          email,
          is_active: true,
          name,
          role,
        })
        .eq("id", existingEmployee.id)
        .select("id")
        .single()
    : await supabase
        .from("employees")
        .insert({
          email,
          is_active: true,
          name,
          role,
          user_id: null,
        })
        .select("id")
        .single()

  if (employeeRow.error) {
    return { ok: false, error: employeeRow.error.message }
  }

  let inviteLink: string | undefined

  try {
    if (isMagicLinkAuthEnabled()) {
      const redirectTo = `${origin}/auth/callback`
      const { error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(email, {
          data: { name },
          redirectTo,
        })

      if (inviteError) {
        const { data: generatedLink, error: generateError } =
          await adminSupabase.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: {
              data: { name },
              redirectTo,
            },
          })

        if (generateError) {
          throw new Error(generateError.message)
        }

        inviteLink = generatedLink.properties.action_link
      }
    } else {
      const authUser = await findAuthUserByEmail(email)

      if (authUser) {
        const { error: updateAuthError } =
          await adminSupabase.auth.admin.updateUserById(authUser.id, {
            email,
            user_metadata: { name },
          })

        if (updateAuthError) {
          throw new Error(updateAuthError.message)
        }
      } else {
        const { error: createAuthError } =
          await adminSupabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { name },
          })

        if (createAuthError) {
          throw new Error(createAuthError.message)
        }
      }

      const redirectTo = `${origin}/auth/recovery`
      const { error: recoveryError } =
        await adminSupabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        })

      const { data: generatedLink, error: generateError } =
        await adminSupabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        })

      if (generateError) {
        throw new Error(generateError.message)
      }

      inviteLink = generatedLink.properties.action_link

      if (recoveryError) {
        throw new Error(recoveryError.message)
      }
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to send the employee invite.",
    }
  }

  revalidateEmployeeAdminRoutes()
  return {
    ok: true,
    message: isMagicLinkAuthEnabled()
      ? "Employee invite sent."
      : "Employee password setup email sent.",
    inviteLink,
    employee: employeeRow.data as AdminEmployeeRecord,
  }
}

export async function updateEmployeeRole(
  employeeId: string,
  role: EmployeeRole
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!employeeId) {
    return { ok: false, error: "Employee record is missing." }
  }

  if (!isEmployeeRole(role)) {
    return { ok: false, error: "Select a valid role." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("employees")
    .update({ role })
    .eq("id", employeeId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateEmployeeAdminRoutes()
  return { ok: true, message: "Employee role updated." }
}

export async function updateEmployeeStatus(
  employeeId: string,
  isActive: boolean
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!employeeId) {
    return { ok: false, error: "Employee record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("employees")
    .update({ is_active: isActive })
    .eq("id", employeeId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateEmployeeAdminRoutes()
  return {
    ok: true,
    message: isActive ? "Employee activated." : "Employee deactivated.",
  }
}

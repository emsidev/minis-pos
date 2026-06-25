"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth.server"
import { isEmployeeRole } from "@/lib/adminEmployees"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import type { EmployeeRole } from "@/lib/database.types"
import { getRequestOrigin } from "@/lib/server-utils"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type EmployeeProfileInput = {
  name: string
  email: string
  role: EmployeeRole
}

export type EmployeeInviteInput = EmployeeProfileInput

export type EmployeeUpdateInput = EmployeeProfileInput & {
  id: string
  isActive: boolean
}

export type EmployeeAdminActionResult = {
  ok: boolean
  message?: string
  error?: string
  inviteLink?: string
  employee?: AdminEmployeeRecord
}

type EmployeeInviteDelivery = {
  inviteLink?: string
  message: string
}

function revalidateEmployeeAdminRoutes() {
  revalidatePath("/admin/employees")
  revalidatePath("/admin/booths")
}

function validateEmployeeProfileInput(input: EmployeeProfileInput) {
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

async function sendEmployeeInviteEmail(input: {
  email: string
  name: string
}): Promise<EmployeeInviteDelivery> {
  const origin = await getRequestOrigin()
  const adminSupabase = createAdminSupabaseClient()

  const authUser = await findAuthUserByEmail(input.email)

  if (authUser) {
    const { error: updateAuthError } =
      await adminSupabase.auth.admin.updateUserById(authUser.id, {
        email: input.email,
        user_metadata: { name: input.name },
      })

    if (updateAuthError) {
      throw new Error(updateAuthError.message)
    }
  } else {
    const { error: createAuthError } =
      await adminSupabase.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: { name: input.name },
      })

    if (createAuthError) {
      throw new Error(createAuthError.message)
    }
  }

  const redirectTo = `${origin}/auth/recovery`
  const { error: recoveryError } =
    await adminSupabase.auth.resetPasswordForEmail(input.email, {
      redirectTo,
    })

  if (!recoveryError) {
    return {
      message: "Password setup email sent.",
    }
  }

  const { data: generatedLink, error: generateError } =
    await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email: input.email,
      options: { redirectTo },
    })

  if (generateError) {
    throw new Error(recoveryError.message)
  }

  return {
    inviteLink: generatedLink.properties.action_link,
    message:
      "Password setup email could not be sent. Share the manual setup link.",
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

async function findEmployeeAuthUser(
  employee: AdminEmployeeRecord,
  nextEmail: string
) {
  if (employee.user_id) {
    return { id: employee.user_id }
  }

  const currentEmail = normalizeEmployeeEmail(employee.email ?? "")
  if (currentEmail) {
    const currentMatch = await findAuthUserByEmail(currentEmail)
    if (currentMatch) {
      return currentMatch
    }
  }

  if (nextEmail !== currentEmail) {
    return findAuthUserByEmail(nextEmail)
  }

  return null
}

export async function inviteEmployee(
  input: EmployeeInviteInput
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = validateEmployeeProfileInput(input)
  if ("error" in parsed) {
    return { ok: false, error: parsed.error }
  }

  const { name, email, role } = parsed
  const supabase = await createServerSupabaseClient()

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
        .select("*")
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
        .select("*")
        .single()

  if (employeeRow.error) {
    return { ok: false, error: employeeRow.error.message }
  }

  try {
    const inviteResult = await sendEmployeeInviteEmail({ email, name })

    revalidateEmployeeAdminRoutes()
    return {
      ok: true,
      message: inviteResult.message,
      inviteLink: inviteResult.inviteLink,
      employee: employeeRow.data as AdminEmployeeRecord,
    }
  } catch (error) {
    return {
      ok: false,
      employee: employeeRow.data as AdminEmployeeRecord,
      error:
        error instanceof Error
          ? error.message
          : "Unable to send the employee invite.",
    }
  }
}

export async function resendEmployeeInvite(
  employeeId: string
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!employeeId) {
    return { ok: false, error: "Employee record is missing." }
  }

  const supabase = await createServerSupabaseClient()
  const { data: employee, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!employee) {
    return { ok: false, error: "Employee record was not found." }
  }

  if (employee.is_active === false) {
    return {
      ok: false,
      error: "Reactivate the employee before resending the invite email.",
    }
  }

  const email = normalizeEmployeeEmail(employee.email ?? "")
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Employee email address is invalid." }
  }

  try {
    const inviteResult = await sendEmployeeInviteEmail({
      email,
      name: employee.name?.trim() || email,
    })

    return {
      ok: true,
      message: inviteResult.message.replace("sent", "resent"),
      inviteLink: inviteResult.inviteLink,
    }
  } catch (inviteError) {
    return {
      ok: false,
      error:
        inviteError instanceof Error
          ? inviteError.message
          : "Unable to resend the invite email.",
    }
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

  const supabase = await createServerSupabaseClient()
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

  const supabase = await createServerSupabaseClient()
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

export async function updateEmployeeDetails(
  input: EmployeeUpdateInput
): Promise<EmployeeAdminActionResult> {
  await requireEmployeeRole("admin")

  if (!input.id) {
    return { ok: false, error: "Employee record is missing." }
  }

  const parsed = validateEmployeeProfileInput(input)
  if ("error" in parsed) {
    return { ok: false, error: parsed.error }
  }

  const supabase = await createServerSupabaseClient()
  const { data: currentEmployee, error: lookupError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", input.id)
    .maybeSingle()

  if (lookupError) {
    return { ok: false, error: lookupError.message }
  }

  if (!currentEmployee) {
    return { ok: false, error: "Employee record was not found." }
  }

  const { data: emailConflict, error: emailConflictError } = await supabase
    .from("employees")
    .select("id")
    .ilike("email", parsed.email)
    .neq("id", input.id)
    .limit(1)
    .maybeSingle()

  if (emailConflictError) {
    return { ok: false, error: emailConflictError.message }
  }

  if (emailConflict) {
    return {
      ok: false,
      error: "Another employee already uses that email address.",
    }
  }

  try {
    const authUser = await findEmployeeAuthUser(currentEmployee, parsed.email)
    if (authUser) {
      const adminSupabase = createAdminSupabaseClient()
      const { error: authError } =
        await adminSupabase.auth.admin.updateUserById(authUser.id, {
          email: parsed.email,
          user_metadata: { name: parsed.name },
        })

      if (authError) {
        return { ok: false, error: authError.message }
      }
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to update the employee sign-in details.",
    }
  }

  const { data: updatedEmployee, error: updateError } = await supabase
    .from("employees")
    .update({
      email: parsed.email,
      is_active: input.isActive,
      name: parsed.name,
      role: parsed.role,
    })
    .eq("id", input.id)
    .select("*")
    .single()

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  revalidateEmployeeAdminRoutes()
  return {
    ok: true,
    message: "Employee updated.",
    employee: updatedEmployee as AdminEmployeeRecord,
  }
}

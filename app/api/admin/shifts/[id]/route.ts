import { NextResponse } from "next/server"

import { getCurrentSessionContext, normalizeEmployeeRole } from "@/lib/auth"
import { getAdminShiftDetailData } from "@/lib/adminBooths"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getCurrentSessionContext()

  if (!session?.employee?.is_active) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (
    session.profileSource !== "live" ||
    normalizeEmployeeRole(session.employee.role) !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  try {
    const { id } = await params
    const detail = await getAdminShiftDetailData(id)
    return NextResponse.json(detail)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load shift details."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

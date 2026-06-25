"use server"

import { revalidatePath } from "next/cache"

import { deleteReceiptPhoto } from "@/app/actions/receipts"
import { requireEmployeeRole } from "@/lib/auth"
import {
  getAdminSalesLedger,
  normalizeAdminSalesView,
  type AdminSalesLedgerView,
} from "@/lib/adminSales"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type AdminSaleActionResult = {
  ok: boolean
  message?: string
  error?: string
}

export async function loadAdminSalesPage(
  startDate: string,
  endDate: string,
  cursor: string,
  view?: AdminSalesLedgerView
) {
  return getAdminSalesLedger(
    startDate,
    endDate,
    cursor,
    normalizeAdminSalesView(view)
  )
}

export async function deleteSalePermanently(
  saleId: string
): Promise<AdminSaleActionResult> {
  await requireEmployeeRole("admin")

  if (!saleId.trim()) {
    return { ok: false, error: "Sale record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, receipt_photo_path, status")
    .eq("id", saleId)
    .maybeSingle()

  if (saleError) {
    return { ok: false, error: saleError.message }
  }

  if (!sale) {
    return {
      ok: false,
      error: "This sale no longer exists. Refresh and try again.",
    }
  }

  if (sale.status !== "deleted") {
    return {
      ok: false,
      error: "Move this sale to trash before deleting it permanently.",
    }
  }

  const { error } = await supabase.from("sales").delete().eq("id", saleId)

  if (error) {
    return { ok: false, error: error.message }
  }

  let cleanupFailed = false
  if (sale.receipt_photo_path) {
    const cleanup = await deleteReceiptPhoto(sale.receipt_photo_path)
    cleanupFailed = !cleanup.ok
  }

  revalidatePath("/admin/sales")
  revalidatePath("/admin/dashboard")
  return {
    ok: true,
    message: cleanupFailed
      ? "Sale deleted permanently, but its receipt file could not be cleaned up."
      : "Sale deleted permanently.",
  }
}

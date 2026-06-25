"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth.server"
import type { Database } from "@/lib/database.types"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const RECEIPT_URL_LIFETIME_SECONDS = 60 * 5
const RECEIPT_BUCKET = "receipts"

const receiptExtensionByMimeType: Record<string, string> = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export type ReceiptUrlResult = {
  ok: boolean
  error?: string
  signedUrl?: string
}

export type ReceiptUploadResult = {
  ok: boolean
  error?: string
  receiptPhotoPath?: string
}

export type ReceiptDeleteResult = {
  ok: boolean
  error?: string
}

export type ReceiptReplaceResult = {
  ok: boolean
  error?: string
  receiptPhotoPath?: string
}

function parseReceiptDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/)

  if (!match) {
    return null
  }

  const [, mimeType, base64Payload] = match
  const normalizedMimeType = mimeType.trim().toLowerCase()
  const extension =
    receiptExtensionByMimeType[normalizedMimeType] ??
    normalizedMimeType.split("/")[1]?.replace(/[^a-z0-9]/g, "") ??
    null

  if (!normalizedMimeType.startsWith("image/") || !extension) {
    return null
  }

  return {
    mimeType: normalizedMimeType,
    extension,
    buffer: Buffer.from(base64Payload, "base64"),
  }
}

function buildReceiptPhotoPath(
  employeeId: string,
  saleId: string,
  extension: string
) {
  return `${employeeId}/${saleId}.${extension}`
}

async function uploadParsedReceiptPhoto(
  receiptPhotoPath: string,
  parsedReceipt: NonNullable<ReturnType<typeof parseReceiptDataUrl>>
) {
  const supabase = createAdminSupabaseClient()

  return await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(receiptPhotoPath, parsedReceipt.buffer, {
      contentType: parsedReceipt.mimeType,
      upsert: true,
    })
}

export async function getReceiptSignedUrl(
  receiptPath: string
): Promise<ReceiptUrlResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!receiptPath.trim()) {
    return { ok: false, error: "Receipt photo is not available." }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(receiptPath, RECEIPT_URL_LIFETIME_SECONDS)

  if (error) {
    return { ok: false, error: "Unable to load this receipt photo." }
  }

  return { ok: true, signedUrl: data.signedUrl }
}

export async function uploadReceiptPhotoForSale(
  saleId: string,
  receiptPhotoDataUrl: string
): Promise<ReceiptUploadResult> {
  try {
    const { employee } = await requireEmployeeRole(["employee", "admin"])

    if (!saleId.trim()) {
      return {
        ok: false,
        error: "Receipt photo upload failed: missing sale id.",
      }
    }

    if (!receiptPhotoDataUrl.trim()) {
      return {
        ok: false,
        error: "Receipt photo upload failed: missing receipt photo.",
      }
    }

    const parsedReceipt = parseReceiptDataUrl(receiptPhotoDataUrl)

    if (!parsedReceipt || parsedReceipt.buffer.byteLength === 0) {
      return {
        ok: false,
        error: "Receipt photo upload failed: invalid receipt photo data.",
      }
    }

    const receiptPhotoPath = buildReceiptPhotoPath(
      employee.id,
      saleId,
      parsedReceipt.extension
    )
    const { error } = await uploadParsedReceiptPhoto(
      receiptPhotoPath,
      parsedReceipt
    )

    if (error) {
      return {
        ok: false,
        error: `Receipt photo upload failed: ${error.message}`,
      }
    }

    return { ok: true, receiptPhotoPath }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Receipt photo upload failed: ${error.message}`
          : "Receipt photo upload failed: unknown error.",
    }
  }
}

type SaleReceiptRecord = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  | "id"
  | "booth_id"
  | "employee_id"
  | "payment_method"
  | "receipt_photo_path"
  | "schedule_id"
> & {
  booth_schedules: Pick<
    Database["public"]["Tables"]["booth_schedules"]["Row"],
    "status" | "operator_employee_id"
  > | null
}

export async function replaceReceiptPhotoForSale(
  saleId: string,
  receiptPhotoDataUrl: string
): Promise<ReceiptReplaceResult> {
  try {
    const { employee } = await requireEmployeeRole(["employee", "admin"])

    if (!saleId.trim()) {
      return { ok: false, error: "Sale record is missing." }
    }

    if (!receiptPhotoDataUrl.trim()) {
      return {
        ok: false,
        error: "Receipt photo update failed: missing receipt photo.",
      }
    }

    const parsedReceipt = parseReceiptDataUrl(receiptPhotoDataUrl)

    if (!parsedReceipt || parsedReceipt.buffer.byteLength === 0) {
      return {
        ok: false,
        error: "Receipt photo update failed: invalid receipt photo data.",
      }
    }

    const adminSupabase = createAdminSupabaseClient()
    const { data: sale, error: saleError } = await adminSupabase
      .from("sales")
      .select(
        "id, booth_id, employee_id, payment_method, receipt_photo_path, schedule_id, booth_schedules(status, operator_employee_id)"
      )
      .eq("id", saleId)
      .maybeSingle()

    if (saleError) {
      return { ok: false, error: "Unable to load this sale right now." }
    }

    const saleRecord = sale as SaleReceiptRecord | null

    if (!saleRecord) {
      return { ok: false, error: "Sale record could not be found." }
    }

    if (saleRecord.payment_method === "cash") {
      return {
        ok: false,
        error: "Cash sales do not have receipt photos to replace.",
      }
    }

    if (!saleRecord.receipt_photo_path) {
      return {
        ok: false,
        error: "Receipt photo is not available for this sale.",
      }
    }

    if (!saleRecord.employee_id) {
      return {
        ok: false,
        error: "This sale is missing its employee record.",
      }
    }

    const schedule = saleRecord.booth_schedules

    if (!schedule || schedule.status !== "scheduled") {
      return {
        ok: false,
        error: "Receipt photos can be changed only while the shift is open.",
      }
    }

    if (
      employee.role !== "admin" &&
      schedule.operator_employee_id !== employee.id
    ) {
      return {
        ok: false,
        error:
          "Only the current POS operator can update receipt photos for this shift.",
      }
    }

    const nextReceiptPhotoPath = buildReceiptPhotoPath(
      saleRecord.employee_id,
      saleRecord.id,
      parsedReceipt.extension
    )

    const { error: uploadError } = await uploadParsedReceiptPhoto(
      nextReceiptPhotoPath,
      parsedReceipt
    )

    if (uploadError) {
      return {
        ok: false,
        error: `Receipt photo update failed: ${uploadError.message}`,
      }
    }

    const previousReceiptPhotoPath = saleRecord.receipt_photo_path
    const { error: updateError } = await adminSupabase
      .from("sales")
      .update({
        receipt_photo_path: nextReceiptPhotoPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleRecord.id)

    if (updateError) {
      if (previousReceiptPhotoPath !== nextReceiptPhotoPath) {
        await adminSupabase.storage
          .from(RECEIPT_BUCKET)
          .remove([nextReceiptPhotoPath])
      }

      return {
        ok: false,
        error: "Receipt photo was uploaded, but the sale could not be updated.",
      }
    }

    if (
      previousReceiptPhotoPath &&
      previousReceiptPhotoPath !== nextReceiptPhotoPath
    ) {
      const { error: deleteError } = await adminSupabase.storage
        .from(RECEIPT_BUCKET)
        .remove([previousReceiptPhotoPath])

      if (deleteError) {
        console.warn("Unable to clean up replaced receipt photo:", {
          saleId: saleRecord.id,
          oldReceiptPhotoPath: previousReceiptPhotoPath,
          newReceiptPhotoPath: nextReceiptPhotoPath,
          error: deleteError.message,
        })
      }
    }

    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/sales")
    revalidatePath("/admin/booths")
    if (saleRecord.booth_id) {
      revalidatePath(`/admin/booths/${saleRecord.booth_id}`)
    }
    revalidatePath("/schedule")
    revalidatePath("/shift")
    if (saleRecord.schedule_id) {
      revalidatePath(`/shift/${saleRecord.schedule_id}`)
    }

    return { ok: true, receiptPhotoPath: nextReceiptPhotoPath }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Receipt photo update failed: unknown error.",
    }
  }
}

export async function deleteReceiptPhoto(
  receiptPath: string
): Promise<ReceiptDeleteResult> {
  try {
    const { employee } = await requireEmployeeRole(["employee", "admin"])

    if (!receiptPath.trim()) {
      return { ok: true }
    }

    if (
      employee.role !== "admin" &&
      !receiptPath.startsWith(`${employee.id}/`)
    ) {
      return {
        ok: false,
        error: "Receipt photo cleanup failed: path does not belong to you.",
      }
    }

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .remove([receiptPath])

    if (error) {
      return {
        ok: false,
        error: `Receipt photo cleanup failed: ${error.message}`,
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Receipt photo cleanup failed: ${error.message}`
          : "Receipt photo cleanup failed: unknown error.",
    }
  }
}

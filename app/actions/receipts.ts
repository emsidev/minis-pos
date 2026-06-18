"use server"

import { requireEmployeeRole } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const RECEIPT_URL_LIFETIME_SECONDS = 60 * 5

export type ReceiptUrlResult = {
  ok: boolean
  error?: string
  signedUrl?: string
}

export async function getReceiptSignedUrl(
  receiptPath: string
): Promise<ReceiptUrlResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!receiptPath.trim()) {
    return { ok: false, error: "Receipt photo is not available." }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(receiptPath, RECEIPT_URL_LIFETIME_SECONDS)

  if (error) {
    return { ok: false, error: "Unable to load this receipt photo." }
  }

  return { ok: true, signedUrl: data.signedUrl }
}

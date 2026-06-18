"use server"

import { getAdminSalesLedger } from "@/lib/adminSales"

export async function loadAdminSalesPage(
  startDate: string,
  endDate: string,
  cursor: string
) {
  return getAdminSalesLedger(startDate, endDate, cursor)
}

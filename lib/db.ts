import Dexie, { type Table } from "dexie"
import { Database, type InventoryEventType } from "./database.types"

type PublicSchema = Database["public"]["Tables"]

export type LocalProduct = Omit<PublicSchema["products"]["Row"], "price"> & {
  price: number // Store as number for easier calculations
}

export type LocalPromo = PublicSchema["promos"]["Row"]
export type LocalPromoProduct = PublicSchema["promo_products"]["Row"]

export type LocalBooth = PublicSchema["booths"]["Row"]

export type LocalBoothSchedule = PublicSchema["booth_schedules"]["Row"]

export type LocalBoothScheduleAssignment =
  PublicSchema["booth_schedule_assignments"]["Row"]

export type LocalBoothScheduleOperatorPeriod =
  PublicSchema["booth_schedule_operator_periods"]["Row"]

export type LocalBoothScheduleProduct =
  PublicSchema["booth_schedule_products"]["Row"]

export type LocalSyncState = "pending" | "syncing" | "synced" | "failed"
export type LocalSyncFailureKind = "transient" | "conflict" | "permanent"

type LocalSyncMetadata = {
  sync_attempt_count: number
  sync_failure_kind: LocalSyncFailureKind | null
  sync_next_retry_at: string | null
}

export type LocalSale = Omit<
  PublicSchema["sales"]["Row"],
  "total_amount" | "promo_discount_total"
> &
  LocalSyncMetadata & {
    total_amount: number
    promo_discount_total: number
    receipt_photo_local: string | null
    sync_state: LocalSyncState
    sync_error: string | null
  }

export type LocalSaleItem = Omit<
  PublicSchema["sale_items"]["Row"],
  "base_unit_price" | "discount_amount" | "unit_price" | "subtotal"
> & {
  base_unit_price: number
  discount_amount: number
  unit_price: number
  subtotal: number
  stock_before: number | null
}

export type LocalEmployee = PublicSchema["employees"]["Row"]

export type LocalInventoryEvent = Omit<
  PublicSchema["inventory_events"]["Row"],
  "created_at"
> &
  LocalSyncMetadata & {
    created_at: string
    event_type: InventoryEventType
    sync_state: LocalSyncState
    sync_error: string | null
  }

export type LocalInventoryEventLine =
  PublicSchema["inventory_event_lines"]["Row"]

type LegacyLocalSale = LocalSale & {
  receipt_photo_url?: string | null
  synced?: boolean
}

type LegacyLocalBoothSchedule = Omit<
  LocalBoothSchedule,
  "operator_employee_id"
> & {
  employee_id?: string
  operator_employee_id?: string
}

export class MinisPOSDatabase extends Dexie {
  products!: Table<LocalProduct>
  promos!: Table<LocalPromo>
  promoProducts!: Table<LocalPromoProduct>
  booths!: Table<LocalBooth>
  boothSchedules!: Table<LocalBoothSchedule>
  boothScheduleAssignments!: Table<LocalBoothScheduleAssignment>
  boothScheduleOperatorPeriods!: Table<LocalBoothScheduleOperatorPeriod>
  boothScheduleProducts!: Table<LocalBoothScheduleProduct>
  sales!: Table<LocalSale>
  saleItems!: Table<LocalSaleItem>
  employees!: Table<LocalEmployee>
  inventoryEvents!: Table<LocalInventoryEvent>
  inventoryEventLines!: Table<LocalInventoryEventLine>

  constructor() {
    super("MinisPOSDB")

    this.version(1).stores({
      products: "id, name, category, is_available",
      booths: "id, name",
      boothSchedules: "id, employee_id, date, [employee_id+date]",
      boothScheduleProducts: "id, schedule_id, product_id",
      sales: "id, employee_id, booth_id, schedule_id, synced, created_at",
      saleItems: "++id, sale_id, product_id",
    })

    // Version 2: adds employees cache table
    this.version(2).stores({
      products: "id, name, category, is_available",
      booths: "id, name",
      boothSchedules: "id, employee_id, date, [employee_id+date]",
      boothScheduleProducts: "id, schedule_id, product_id",
      sales: "id, employee_id, booth_id, schedule_id, synced, created_at",
      saleItems: "++id, sale_id, product_id",
      employees: "id, user_id, email, name, role",
    })

    this.version(3)
      .stores({
        products: "id, name, category, is_available",
        booths: "id, name",
        boothSchedules: "id, employee_id, date, [employee_id+date]",
        boothScheduleProducts:
          "id, schedule_id, product_id, [schedule_id+product_id]",
        sales: "id, employee_id, booth_id, schedule_id, sync_state, created_at",
        saleItems: "++id, sale_id, product_id",
        employees: "id, user_id, email, name, role",
      })
      .upgrade((transaction) =>
        transaction
          .table("sales")
          .toCollection()
          .modify((sale: LegacyLocalSale) => {
            sale.receipt_photo_path =
              sale.receipt_photo_path ?? sale.receipt_photo_url ?? null
            sale.sync_state =
              sale.sync_state ?? (sale.synced ? "synced" : "pending")
            sale.sync_error = sale.sync_error ?? null
            delete sale.receipt_photo_url
            delete sale.synced
          })
      )

    this.version(4).stores({
      products: "id, name, category, is_available",
      booths: "id, name",
      boothSchedules: "id, employee_id, date, [employee_id+date]",
      boothScheduleProducts:
        "id, schedule_id, product_id, [schedule_id+product_id]",
      sales: "id, employee_id, booth_id, schedule_id, sync_state, created_at",
      saleItems: "++id, sale_id, product_id",
      employees: "id, user_id, email, name, role",
      inventoryEvents:
        "id, schedule_id, actor_employee_id, event_type, sync_state, occurred_at",
      inventoryEventLines: "id, event_id, product_id",
    })

    this.version(5)
      .stores({
        products: "id, name, category, is_available",
        booths: "id, name",
        boothSchedules:
          "id, operator_employee_id, date, [operator_employee_id+date]",
        boothScheduleAssignments:
          "[schedule_id+employee_id], schedule_id, employee_id",
        boothScheduleOperatorPeriods:
          "id, schedule_id, operator_employee_id, starts_at",
        boothScheduleProducts:
          "id, schedule_id, product_id, [schedule_id+product_id]",
        sales: "id, employee_id, booth_id, schedule_id, sync_state, created_at",
        saleItems: "++id, sale_id, product_id",
        employees: "id, user_id, email, name, role",
        inventoryEvents:
          "id, schedule_id, actor_employee_id, event_type, sync_state, occurred_at",
        inventoryEventLines: "id, event_id, product_id",
      })
      .upgrade(async (transaction) => {
        const schedules = await transaction
          .table<LegacyLocalBoothSchedule>("boothSchedules")
          .toArray()

        await transaction
          .table<LegacyLocalBoothSchedule>("boothSchedules")
          .toCollection()
          .modify((schedule) => {
            schedule.operator_employee_id =
              schedule.operator_employee_id ?? schedule.employee_id
            delete schedule.employee_id
          })

        await transaction
          .table<LocalBoothScheduleAssignment>("boothScheduleAssignments")
          .bulkPut(
            schedules.flatMap((schedule) => {
              const employeeId =
                schedule.operator_employee_id ?? schedule.employee_id
              return employeeId
                ? [
                    {
                      schedule_id: schedule.id,
                      employee_id: employeeId,
                      assigned_at:
                        schedule.created_at ?? new Date().toISOString(),
                    },
                  ]
                : []
            })
          )
      })

    this.version(6)
      .stores({
        products: "id, name, category, is_available",
        booths: "id, name",
        boothSchedules:
          "id, operator_employee_id, date, [operator_employee_id+date]",
        boothScheduleAssignments:
          "[schedule_id+employee_id], schedule_id, employee_id",
        boothScheduleOperatorPeriods:
          "id, schedule_id, operator_employee_id, starts_at",
        boothScheduleProducts:
          "id, schedule_id, product_id, [schedule_id+product_id]",
        sales:
          "id, employee_id, booth_id, schedule_id, sync_state, sync_failure_kind, sync_next_retry_at, created_at",
        saleItems: "++id, sale_id, product_id",
        employees: "id, user_id, email, name, role",
        inventoryEvents:
          "id, schedule_id, actor_employee_id, event_type, sync_state, sync_failure_kind, sync_next_retry_at, occurred_at",
        inventoryEventLines: "id, event_id, product_id",
      })
      .upgrade(async (transaction) => {
        await Promise.all([
          transaction
            .table<LocalSale>("sales")
            .toCollection()
            .modify((sale) => {
              sale.sync_attempt_count = sale.sync_attempt_count ?? 0
              sale.sync_failure_kind =
                sale.sync_failure_kind ??
                (sale.sync_state === "failed" ? "transient" : null)
              sale.sync_next_retry_at = sale.sync_next_retry_at ?? null
            }),
          transaction
            .table<LocalInventoryEvent>("inventoryEvents")
            .toCollection()
            .modify((event) => {
              event.sync_attempt_count = event.sync_attempt_count ?? 0
              event.sync_failure_kind =
                event.sync_failure_kind ??
                (event.sync_state === "failed" ? "transient" : null)
              event.sync_next_retry_at = event.sync_next_retry_at ?? null
            }),
        ])
      })

    this.version(7)
      .stores({
        products: "id, name, category, is_available",
        booths: "id, name",
        boothSchedules:
          "id, operator_employee_id, date, [operator_employee_id+date]",
        boothScheduleAssignments:
          "[schedule_id+employee_id], schedule_id, employee_id",
        boothScheduleOperatorPeriods:
          "id, schedule_id, operator_employee_id, starts_at",
        boothScheduleProducts:
          "id, schedule_id, product_id, [schedule_id+product_id]",
        sales:
          "id, employee_id, booth_id, schedule_id, sync_state, sync_failure_kind, sync_next_retry_at, created_at",
        saleItems: "++id, sale_id, product_id",
        employees: "id, user_id, email, name, role",
        inventoryEvents:
          "id, schedule_id, actor_employee_id, event_type, sync_state, sync_failure_kind, sync_next_retry_at, occurred_at",
        inventoryEventLines: "id, event_id, product_id",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<LocalSale>("sales")
          .toCollection()
          .modify((sale) => {
            sale.updated_at = sale.updated_at ?? sale.created_at
          })
      })

    this.version(8)
      .stores({
        products: "id, name, category, is_available",
        promos: "id, is_active, starts_on, ends_on",
        promoProducts: "[promo_id+product_id+role], promo_id, product_id, role",
        booths: "id, name",
        boothSchedules:
          "id, operator_employee_id, date, [operator_employee_id+date]",
        boothScheduleAssignments:
          "[schedule_id+employee_id], schedule_id, employee_id",
        boothScheduleOperatorPeriods:
          "id, schedule_id, operator_employee_id, starts_at",
        boothScheduleProducts:
          "id, schedule_id, product_id, [schedule_id+product_id]",
        sales:
          "id, employee_id, booth_id, schedule_id, sync_state, sync_failure_kind, sync_next_retry_at, created_at",
        saleItems: "++id, sale_id, product_id",
        employees: "id, user_id, email, name, role",
        inventoryEvents:
          "id, schedule_id, actor_employee_id, event_type, sync_state, sync_failure_kind, sync_next_retry_at, occurred_at",
        inventoryEventLines: "id, event_id, product_id",
      })
      .upgrade(async (transaction) => {
        await Promise.all([
          transaction
            .table<LocalSale>("sales")
            .toCollection()
            .modify((sale) => {
              sale.promo_id = sale.promo_id ?? null
              sale.promo_name = sale.promo_name ?? null
              sale.promo_type = sale.promo_type ?? null
              sale.promo_discount_total = sale.promo_discount_total ?? 0
              sale.promo_approval_id = sale.promo_approval_id ?? null
            }),
          transaction
            .table<LocalSaleItem>("saleItems")
            .toCollection()
            .modify((item) => {
              item.base_unit_price = item.base_unit_price ?? item.unit_price
              item.discount_amount = item.discount_amount ?? 0
            }),
        ])
      })
  }
}

export const db = new MinisPOSDatabase()

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EmployeeRole = "employee" | "admin"
export type ScheduleStatus = "scheduled" | "closed" | "cancelled"
export type InventoryEventType =
  | "opening"
  | "adjustment"
  | "admin_override"
  | "closeout"

export type PaymentMethod =
  | "cash"
  | "gcash"
  | "maya"
  | "maribank"
  | "unionbank"
  | "other"

export interface Database {
  public: {
    Tables: {
      booths: {
        Row: {
          created_at: string | null
          google_maps_url: string | null
          id: string
          is_active: boolean | null
          location_lat: string | null
          location_lng: string | null
          location_text: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          location_lat?: string | null
          location_lng?: string | null
          location_text?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          location_lat?: string | null
          location_lng?: string | null
          location_text?: string | null
          name?: string
        }
        Relationships: []
      }
      booth_schedules: {
        Row: {
          booth_id: string
          created_at: string | null
          date: string
          end_time: string
          id: string
          operator_employee_id: string | null
          start_time: string
          status: ScheduleStatus
        }
        Insert: {
          booth_id: string
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          operator_employee_id?: string | null
          start_time: string
          status?: ScheduleStatus
        }
        Update: {
          booth_id?: string
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          operator_employee_id?: string | null
          start_time?: string
          status?: ScheduleStatus
        }
        Relationships: [
          {
            foreignKeyName: "booth_schedules_booth_id_fkey"
            columns: ["booth_id"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_schedules_operator_employee_id_fkey"
            columns: ["operator_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      booth_schedule_assignments: {
        Row: {
          assigned_at: string
          employee_id: string
          schedule_id: string
        }
        Insert: {
          assigned_at?: string
          employee_id: string
          schedule_id: string
        }
        Update: {
          assigned_at?: string
          employee_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booth_schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      booth_schedule_operator_periods: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          initiated_by_employee_id: string
          operator_employee_id: string
          schedule_id: string
          starts_at: string
          transition_type: "scheduled" | "takeover"
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          initiated_by_employee_id: string
          operator_employee_id: string
          schedule_id: string
          starts_at: string
          transition_type?: "scheduled" | "takeover"
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          initiated_by_employee_id?: string
          operator_employee_id?: string
          schedule_id?: string
          starts_at?: string
          transition_type?: "scheduled" | "takeover"
        }
        Relationships: [
          {
            foreignKeyName: "booth_schedule_operator_periods_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_schedule_operator_periods_operator_employee_id_fkey"
            columns: ["operator_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_schedule_operator_periods_initiated_by_employee_id_fkey"
            columns: ["initiated_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      booth_schedule_products: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          stock: number
          schedule_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          stock?: number
          schedule_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          stock?: number
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booth_schedule_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_schedule_products_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_events: {
        Row: {
          actor_employee_id: string
          created_at: string
          event_type: InventoryEventType
          id: string
          occurred_at: string
          reason: string | null
          schedule_id: string
        }
        Insert: {
          actor_employee_id: string
          created_at?: string
          event_type: InventoryEventType
          id: string
          occurred_at?: string
          reason?: string | null
          schedule_id: string
        }
        Update: {
          actor_employee_id?: string
          created_at?: string
          event_type?: InventoryEventType
          id?: string
          occurred_at?: string
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_actor_employee_id_fkey"
            columns: ["actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_event_lines: {
        Row: {
          delta: number
          event_id: string
          id: string
          previous_stock: number
          product_id: string
          resulting_stock: number
        }
        Insert: {
          delta: number
          event_id: string
          id?: string
          previous_stock: number
          product_id: string
          resulting_stock: number
        }
        Update: {
          delta?: number
          event_id?: string
          id?: string
          previous_stock?: number
          product_id?: string
          resulting_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_event_lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_event_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: string
        }
        Relationships: []
      }
      promo_products: {
        Row: {
          created_at: string
          product_id: string
          promo_id: string
          role: "qualifying" | "reward"
        }
        Insert: {
          created_at?: string
          product_id: string
          promo_id: string
          role?: "qualifying" | "reward"
        }
        Update: {
          created_at?: string
          product_id?: string
          promo_id?: string
          role?: "qualifying" | "reward"
        }
        Relationships: [
          {
            foreignKeyName: "promo_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_products_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
        ]
      }
      promos: {
        Row: {
          benefit: Json
          created_at: string
          criteria: Json
          ends_on: string
          id: string
          is_active: boolean
          name: string
          promo_type:
            | "percent_off"
            | "fixed_amount_off"
            | "special_price"
            | "buy_x_get_y"
            | "bundle_price"
            | "free_item"
          requires_admin_approval: boolean
          starts_on: string
          updated_at: string
        }
        Insert: {
          benefit?: Json
          created_at?: string
          criteria?: Json
          ends_on: string
          id?: string
          is_active?: boolean
          name: string
          promo_type:
            | "percent_off"
            | "fixed_amount_off"
            | "special_price"
            | "buy_x_get_y"
            | "bundle_price"
            | "free_item"
          requires_admin_approval?: boolean
          starts_on: string
          updated_at?: string
        }
        Update: {
          benefit?: Json
          created_at?: string
          criteria?: Json
          ends_on?: string
          id?: string
          is_active?: boolean
          name?: string
          promo_type?:
            | "percent_off"
            | "fixed_amount_off"
            | "special_price"
            | "buy_x_get_y"
            | "bundle_price"
            | "free_item"
          requires_admin_approval?: boolean
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          base_unit_price: string
          discount_amount: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: string
          unit_price: string
        }
        Insert: {
          base_unit_price?: string
          discount_amount?: string
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: string
          unit_price: string
        }
        Update: {
          base_unit_price?: string
          discount_amount?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: string
          unit_price?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          booth_id: string
          created_at: string
          employee_id: string
          id: string
          payment_method: PaymentMethod
          promo_approval_id: string | null
          promo_discount_total: string
          promo_id: string | null
          promo_name: string | null
          promo_type: string | null
          receipt_photo_path: string | null
          schedule_id: string
          status: string
          total_amount: string
          updated_at: string
        }
        Insert: {
          booth_id: string
          created_at?: string
          employee_id: string
          id?: string
          payment_method?: PaymentMethod
          promo_approval_id?: string | null
          promo_discount_total?: string
          promo_id?: string | null
          promo_name?: string | null
          promo_type?: string | null
          receipt_photo_path?: string | null
          schedule_id: string
          status?: string
          total_amount: string
          updated_at?: string
        }
        Update: {
          booth_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          payment_method?: PaymentMethod
          promo_approval_id?: string | null
          promo_discount_total?: string
          promo_id?: string | null
          promo_name?: string | null
          promo_type?: string | null
          receipt_photo_path?: string | null
          schedule_id?: string
          status?: string
          total_amount?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_booth_id_fkey"
            columns: ["booth_id"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_promo_approval_id_fkey"
            columns: ["promo_approval_id"]
            isOneToOne: false
            referencedRelation: "shift_action_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_closeouts: {
        Row: {
          cash_deductions_total: string
          cash_variance: string
          closed_at: string
          closed_by_employee_id: string
          counted_cash_sales: string
          counted_stock_total: number
          id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by_employee_id: string | null
          schedule_id: string
          stock_variance: number
          system_cash_sales: string
          system_stock_total: number
        }
        Insert: {
          cash_deductions_total?: string
          cash_variance: string
          closed_at?: string
          closed_by_employee_id: string
          counted_cash_sales: string
          counted_stock_total: number
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_employee_id?: string | null
          schedule_id: string
          stock_variance: number
          system_cash_sales: string
          system_stock_total: number
        }
        Update: {
          cash_deductions_total?: string
          cash_variance?: string
          closed_at?: string
          closed_by_employee_id?: string
          counted_cash_sales?: string
          counted_stock_total?: number
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_employee_id?: string | null
          schedule_id?: string
          stock_variance?: number
          system_cash_sales?: string
          system_stock_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_closeouts_closed_by_employee_id_fkey"
            columns: ["closed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_closeouts_reopened_by_employee_id_fkey"
            columns: ["reopened_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_closeouts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_promos: {
        Row: {
          created_at: string
          discount_total: string
          id: string
          promo_approval_id: string | null
          promo_id: string | null
          promo_name: string
          promo_type: string
          sale_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          discount_total?: string
          id?: string
          promo_approval_id?: string | null
          promo_id?: string | null
          promo_name: string
          promo_type: string
          sale_id: string
          snapshot?: Json
        }
        Update: {
          created_at?: string
          discount_total?: string
          id?: string
          promo_approval_id?: string | null
          promo_id?: string | null
          promo_name?: string
          promo_type?: string
          sale_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sale_promos_promo_approval_id_fkey"
            columns: ["promo_approval_id"]
            isOneToOne: false
            referencedRelation: "shift_action_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_promos_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_promos_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_action_approvals: {
        Row: {
          action_type:
            | "reopen_shift"
            | "edit_sale"
            | "delete_sale"
            | "apply_promo"
            | "cash_deduction"
          created_at: string
          id: string
          payload: Json
          requested_by_employee_id: string
          resolved_at: string | null
          resolved_by_employee_id: string | null
          schedule_id: string
          status: "pending" | "approved" | "rejected"
          updated_at: string
        }
        Insert: {
          action_type:
            | "reopen_shift"
            | "edit_sale"
            | "delete_sale"
            | "apply_promo"
            | "cash_deduction"
          created_at?: string
          id?: string
          payload?: Json
          requested_by_employee_id: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          schedule_id: string
          status?: "pending" | "approved" | "rejected"
          updated_at?: string
        }
        Update: {
          action_type?:
            | "reopen_shift"
            | "edit_sale"
            | "delete_sale"
            | "apply_promo"
            | "cash_deduction"
          created_at?: string
          id?: string
          payload?: Json
          requested_by_employee_id?: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          schedule_id?: string
          status?: "pending" | "approved" | "rejected"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_action_approvals_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_action_approvals_resolved_by_employee_id_fkey"
            columns: ["resolved_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_action_approvals_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_admin_dashboard: {
        Args: {
          p_date: string
        }
        Returns: Json
      }
      deactivate_booth_and_cancel_future_schedules: {
        Args: {
          p_booth_id: string
          p_current_date: string
          p_current_time: string
        }
        Returns: number
      }
      save_booth_schedule: {
        Args: {
          p_schedule_id: string | null
          p_booth_id: string
          p_employee_ids: string[]
          p_operator_employee_id: string | null
          p_date: string
          p_start_time: string
          p_end_time: string
          p_current_date: string
          p_current_time: string
        }
        Returns: string
      }
      save_booth_schedule_range: {
        Args: {
          p_booth_id: string
          p_employee_ids: string[]
          p_operator_employee_id: string | null
          p_start_date: string
          p_end_date: string
          p_start_time: string
          p_end_time: string
          p_current_date: string
          p_current_time: string
        }
        Returns: number
      }
      get_employee_schedule_browser: {
        Args: {
          p_start_date: string
          p_end_date: string
        }
        Returns: Json
      }
      get_employee_schedule_detail: {
        Args: {
          p_schedule_id: string
        }
        Returns: Json
      }
      get_employee_schedule_sale_items: {
        Args: {
          p_sale_id: string
        }
        Returns: Json
      }
      join_booth_schedule: {
        Args: {
          p_schedule_id: string
        }
        Returns: string
      }
      claim_shift_operator: {
        Args: {
          p_schedule_id: string
        }
        Returns: string
      }
      record_shift_inventory_event: {
        Args: {
          p_event_id: string
          p_schedule_id: string
          p_event_type: "opening" | "adjustment"
          p_reason: string | null
          p_occurred_at: string
          p_lines: Json
        }
        Returns: string
      }
      record_admin_inventory_override: {
        Args: {
          p_event_id: string
          p_schedule_id: string
          p_reason: string
          p_lines: Json
        }
        Returns: string
      }
      close_shift: {
        Args: {
          p_schedule_id: string
          p_counted_cash_sales: number
          p_lines: Json
        }
        Returns: string
      }
      cancel_booth_schedule: {
        Args: {
          p_schedule_id: string
          p_current_date: string
          p_current_time: string
        }
        Returns: string
      }
      delete_booth_schedule_cascade: {
        Args: {
          p_schedule_id: string
        }
        Returns: string
      }
      reopen_shift: {
        Args: {
          p_schedule_id: string
          p_reason: string
        }
        Returns: string
      }
      request_shift_action_approval: {
        Args: {
          p_schedule_id: string
          p_action_type: string
          p_payload?: Json
        }
        Returns: string
      }
      request_shift_cash_deduction: {
        Args: {
          p_schedule_id: string
          p_amount: number
          p_reason: string
        }
        Returns: string
      }
      get_pending_shift_action_approvals: {
        Args: {
          p_schedule_id?: string | null
        }
        Returns: Json
      }
      resolve_shift_action_approval: {
        Args: {
          p_approval_id: string
          p_decision: string
        }
        Returns: string
      }
      submit_sale_change: {
        Args: {
          p_action_type: string
          p_payload?: Json
          p_sale_id: string
        }
        Returns: Json
      }
      delete_booth_cascade: {
        Args: {
          p_booth_id: string
        }
        Returns: Json
      }
      finalize_pos_sale: {
        Args: {
          p_sale_id: string
          p_booth_id: string
          p_schedule_id: string
          p_total_amount: number
          p_payment_method: PaymentMethod
          p_receipt_photo_path: string | null
          p_created_at: string
          p_items: Json
          p_promo_id?: string | null
          p_promo_name?: string | null
          p_promo_type?: string | null
          p_promo_discount_total?: number | null
          p_promo_approval_id?: string | null
          p_promo_snapshot?: Json | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

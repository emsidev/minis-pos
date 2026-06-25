export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          transition_type: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          initiated_by_employee_id: string
          operator_employee_id: string
          schedule_id: string
          starts_at: string
          transition_type?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          initiated_by_employee_id?: string
          operator_employee_id?: string
          schedule_id?: string
          starts_at?: string
          transition_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booth_schedule_operator_periods_initiated_by_employee_id_fkey"
            columns: ["initiated_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "booth_schedule_operator_periods_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "booth_schedules"
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
          schedule_id: string
          stock: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          schedule_id: string
          stock?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          schedule_id?: string
          stock?: number
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
      booth_schedules: {
        Row: {
          booth_id: string
          created_at: string | null
          date: string
          end_time: string
          id: string
          operator_employee_id: string | null
          start_time: string
          status: string
        }
        Insert: {
          booth_id: string
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          operator_employee_id?: string | null
          start_time: string
          status?: string
        }
        Update: {
          booth_id?: string
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          operator_employee_id?: string | null
          start_time?: string
          status?: string
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
      booths: {
        Row: {
          created_at: string | null
          google_maps_url: string | null
          id: string
          is_active: boolean | null
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          approval_status: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string
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
      inventory_events: {
        Row: {
          actor_employee_id: string
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          reason: string | null
          schedule_id: string
        }
        Insert: {
          actor_employee_id: string
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          reason?: string | null
          schedule_id: string
        }
        Update: {
          actor_employee_id?: string
          created_at?: string
          event_type?: string
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
      products: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      promo_products: {
        Row: {
          created_at: string
          product_id: string
          promo_id: string
          role: string
        }
        Insert: {
          created_at?: string
          product_id: string
          promo_id: string
          role?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          promo_id?: string
          role?: string
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
          promo_type: string
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
          promo_type: string
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
          promo_type?: string
          requires_admin_approval?: boolean
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          base_unit_price: number
          discount_amount: number
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          base_unit_price: number
          discount_amount?: number
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          subtotal: number
          unit_price: number
        }
        Update: {
          base_unit_price?: number
          discount_amount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          subtotal?: number
          unit_price?: number
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
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_promos: {
        Row: {
          created_at: string
          discount_total: number
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
          discount_total?: number
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
          discount_total?: number
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
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          booth_id: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          payment_method: string | null
          promo_approval_id: string | null
          promo_discount_total: number
          promo_id: string | null
          promo_name: string | null
          promo_type: string | null
          receipt_photo_local: string | null
          receipt_photo_path: string | null
          receipt_photo_url: string | null
          schedule_id: string | null
          status: string | null
          synced: boolean | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          booth_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          payment_method?: string | null
          promo_approval_id?: string | null
          promo_discount_total?: number
          promo_id?: string | null
          promo_name?: string | null
          promo_type?: string | null
          receipt_photo_local?: string | null
          receipt_photo_path?: string | null
          receipt_photo_url?: string | null
          schedule_id?: string | null
          status?: string | null
          synced?: boolean | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          booth_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          payment_method?: string | null
          promo_approval_id?: string | null
          promo_discount_total?: number
          promo_id?: string | null
          promo_name?: string | null
          promo_type?: string | null
          receipt_photo_local?: string | null
          receipt_photo_path?: string | null
          receipt_photo_url?: string | null
          schedule_id?: string | null
          status?: string | null
          synced?: boolean | null
          total_amount?: number
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
      shift_action_approvals: {
        Row: {
          action_type: string
          created_at: string
          id: string
          payload: Json
          requested_by_employee_id: string
          resolved_at: string | null
          resolved_by_employee_id: string | null
          schedule_id: string
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          payload?: Json
          requested_by_employee_id: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          schedule_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          payload?: Json
          requested_by_employee_id?: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          schedule_id?: string
          status?: string
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
      shift_closeouts: {
        Row: {
          cash_deductions_total: number
          cash_variance: number
          closed_at: string
          closed_by_employee_id: string
          counted_cash_sales: number
          counted_stock_total: number
          id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by_employee_id: string | null
          schedule_id: string
          stock_variance: number
          system_cash_sales: number
          system_stock_total: number
        }
        Insert: {
          cash_deductions_total?: number
          cash_variance: number
          closed_at?: string
          closed_by_employee_id: string
          counted_cash_sales: number
          counted_stock_total: number
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_employee_id?: string | null
          schedule_id: string
          stock_variance: number
          system_cash_sales: number
          system_stock_total: number
        }
        Update: {
          cash_deductions_total?: number
          cash_variance?: number
          closed_at?: string
          closed_by_employee_id?: string
          counted_cash_sales?: number
          counted_stock_total?: number
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_employee_id?: string | null
          schedule_id?: string
          stock_variance?: number
          system_cash_sales?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_sale_change_from_payload: {
        Args: {
          p_action_type: string
          p_actor_employee_id: string
          p_payload: Json
          p_sale_id: string
        }
        Returns: string
      }
      cancel_booth_schedule: {
        Args: {
          p_current_date: string
          p_current_time: string
          p_schedule_id: string
        }
        Returns: string
      }
      claim_shift_operator: { Args: { p_schedule_id: string }; Returns: string }
      close_shift: {
        Args: {
          p_counted_cash_sales: number
          p_lines: Json
          p_schedule_id: string
        }
        Returns: string
      }
      current_employee_id: { Args: never; Returns: string }
      current_employee_is_admin: { Args: never; Returns: boolean }
      current_employee_is_assigned: {
        Args: { p_schedule_id: string }
        Returns: boolean
      }
      deactivate_booth_and_cancel_future_schedules: {
        Args: {
          p_booth_id: string
          p_current_date: string
          p_current_time: string
        }
        Returns: number
      }
      delete_booth_cascade: { Args: { p_booth_id: string }; Returns: Json }
      delete_booth_schedule_cascade: {
        Args: { p_schedule_id: string }
        Returns: string
      }
      finalize_pos_sale:
        | {
            Args: {
              p_booth_id: string
              p_created_at: string
              p_items: Json
              p_payment_method: string
              p_promo_approval_id?: string
              p_promo_discount_total?: number
              p_promo_id?: string
              p_promo_name?: string
              p_promo_snapshot?: Json
              p_promo_type?: string
              p_receipt_photo_path: string
              p_sale_id: string
              p_schedule_id: string
              p_total_amount: number
            }
            Returns: string
          }
        | {
            Args: {
              p_booth_id: string
              p_created_at: string
              p_items: Json
              p_payment_method: string
              p_payments?: Json
              p_promo_approval_id?: string
              p_promo_discount_total?: number
              p_promo_id?: string
              p_promo_name?: string
              p_promo_snapshot?: Json
              p_promo_type?: string
              p_receipt_photo_path: string
              p_sale_id: string
              p_schedule_id: string
              p_total_amount: number
            }
            Returns: string
          }
      get_admin_dashboard: { Args: { p_date: string }; Returns: Json }
      get_employee_schedule_browser: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_employee_schedule_detail: {
        Args: { p_schedule_id: string }
        Returns: Json
      }
      get_employee_schedule_sale_items: {
        Args: { p_sale_id: string }
        Returns: Json
      }
      get_pending_shift_action_approvals: {
        Args: { p_schedule_id?: string }
        Returns: Json
      }
      join_booth_schedule: { Args: { p_schedule_id: string }; Returns: string }
      record_admin_inventory_override: {
        Args: {
          p_event_id: string
          p_lines: Json
          p_reason: string
          p_schedule_id: string
        }
        Returns: string
      }
      record_shift_inventory_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_lines: Json
          p_occurred_at: string
          p_reason: string
          p_schedule_id: string
        }
        Returns: string
      }
      reopen_shift: {
        Args: { p_reason: string; p_schedule_id: string }
        Returns: string
      }
      request_shift_action_approval: {
        Args: { p_action_type: string; p_payload?: Json; p_schedule_id: string }
        Returns: string
      }
      request_shift_cash_deduction: {
        Args: { p_amount: number; p_reason: string; p_schedule_id: string }
        Returns: string
      }
      resolve_shift_action_approval: {
        Args: { p_approval_id: string; p_decision: string }
        Returns: string
      }
      save_booth_schedule: {
        Args: {
          p_booth_id: string
          p_current_date: string
          p_current_time: string
          p_date: string
          p_employee_ids: string[]
          p_end_time: string
          p_operator_employee_id: string
          p_schedule_id: string
          p_start_time: string
        }
        Returns: string
      }
      save_booth_schedule_range: {
        Args: {
          p_booth_id: string
          p_current_date: string
          p_current_time: string
          p_employee_ids: string[]
          p_end_date: string
          p_end_time: string
          p_operator_employee_id: string
          p_start_date: string
          p_start_time: string
        }
        Returns: number
      }
      submit_sale_change: {
        Args: { p_action_type: string; p_payload?: Json; p_sale_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

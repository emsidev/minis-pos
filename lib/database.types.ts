export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EmployeeRole = "employee" | "admin"

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
          employee_id: string
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          booth_id: string
          created_at?: string | null
          date: string
          employee_id: string
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          booth_id?: string
          created_at?: string | null
          date?: string
          employee_id?: string
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
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
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          subtotal: string
          unit_price: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          subtotal: string
          unit_price: string
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          subtotal?: string
          unit_price?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          booth_id: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          payment_method: string | null
          receipt_photo_local: string | null
          receipt_photo_url: string | null
          schedule_id: string | null
          status: string | null
          synced: boolean | null
          total_amount: string
        }
        Insert: {
          booth_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          payment_method?: string | null
          receipt_photo_local?: string | null
          receipt_photo_url?: string | null
          schedule_id?: string | null
          status?: string | null
          synced?: boolean | null
          total_amount: string
        }
        Update: {
          booth_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          payment_method?: string | null
          receipt_photo_local?: string | null
          receipt_photo_url?: string | null
          schedule_id?: string | null
          status?: string | null
          synced?: boolean | null
          total_amount?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

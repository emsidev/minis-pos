"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/database.types"
import { assertSupabaseConfigured, publicEnv } from "@/lib/env"

export async function createServerSupabaseClient() {
  assertSupabaseConfigured()

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies()

          return cookieStore.getAll().map(({ name, value }) => ({
            name,
            value,
          }))
        },
        async setAll(cookieValues) {
          try {
            const cookieStore = await cookies()

            for (const { name, value, options } of cookieValues) {
              cookieStore.set({ name, value, ...options })
            }
          } catch {
            // Server Components can read cookies during render but cannot always mutate them.
          }
        },
      },
    }
  )
}

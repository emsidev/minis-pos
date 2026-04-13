import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/database.types"
import { assertSupabaseConfigured, publicEnv } from "@/lib/env"

export function createServerSupabaseClient() {
  assertSupabaseConfigured()

  const cookieStore = cookies()

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Server Components can read cookies during render but cannot always mutate them.
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 })
          } catch {
            // Server Components can read cookies during render but cannot always mutate them.
          }
        },
      },
    }
  )
}

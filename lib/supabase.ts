import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { assertSupabaseConfigured, publicEnv } from "@/lib/env"

let browserClient: SupabaseClient<Database> | undefined

export function createClient() {
  assertSupabaseConfigured()

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey
    )
  }

  return browserClient
}

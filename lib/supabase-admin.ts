import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { assertSupabaseAdminConfigured, publicEnv, serverEnv } from "@/lib/env"

let adminClient: ReturnType<typeof createClient<Database>> | undefined

export function createAdminSupabaseClient() {
  assertSupabaseAdminConfigured()

  if (!adminClient) {
    adminClient = createClient<Database>(
      publicEnv.supabaseUrl,
      serverEnv.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }

  return adminClient
}

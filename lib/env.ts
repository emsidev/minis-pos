const DEFAULT_APP_NAME = "Mini's Pastries"

function isPlaceholderValue(value: string | undefined) {
  if (!value) {
    return true
  }

  return (
    value.includes("your_supabase") ||
    value.includes("replace_with") ||
    value.includes("placeholder") ||
    value.includes("example")
  )
}

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
}

export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
}

export const isSupabaseConfigured =
  !isPlaceholderValue(publicEnv.supabaseUrl) &&
  !isPlaceholderValue(publicEnv.supabaseAnonKey)

export const isSupabaseAdminConfigured =
  isSupabaseConfigured && !isPlaceholderValue(serverEnv.supabaseServiceRoleKey)

export function isMagicLinkAuthEnabled() {
  return process.env.magiclink?.trim().toLowerCase() !== "false"
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing. Update .env.local with your project URL and anon key."
    )
  }
}

export function assertSupabaseAdminConfigured() {
  if (!isSupabaseAdminConfigured) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Update .env.local with your Supabase service role key."
    )
  }
}

const DEFAULT_APP_NAME = "Mini's Pastries"

function isPlaceholderValue(value: string | undefined) {
  if (!value) {
    return true
  }

  return (
    value.includes("your_supabase") ||
    value.includes("placeholder") ||
    value.includes("example")
  )
}

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
}

export const isSupabaseConfigured =
  !isPlaceholderValue(publicEnv.supabaseUrl) &&
  !isPlaceholderValue(publicEnv.supabaseAnonKey)

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing. Update .env.local with your project URL and anon key."
    )
  }
}

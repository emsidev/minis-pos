import { headers } from "next/headers"

/**
 * Detects the request origin from headers.
 * Useful for generating full redirect URLs in server actions and routes.
 */
export async function getRequestOrigin() {
  const headerList = await headers()
  const forwardedHost = headerList.get("x-forwarded-host")
  const host = forwardedHost ?? headerList.get("host")
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https")

  return host ? `${protocol}://${host}` : "http://localhost:3000"
}

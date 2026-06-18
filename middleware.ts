import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"
import { isSupabaseConfigured, publicEnv } from "@/lib/env"

const publicRoutes = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/recovery",
  "/offline-access",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon",
  "/apple-icon",
]

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const routeIsPublic = isPublicRoute(pathname)

  if (!isSupabaseConfigured) {
    if (routeIsPublic) {
      return NextResponse.next()
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("error", "config")

    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  // Use getSession() for the fast, cookie-based check — works offline.
  // getUser() makes a network call to Supabase and will fail without connectivity,
  // causing an incorrect redirect to login even when the user is authenticated.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && !routeIsPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*\\.js|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

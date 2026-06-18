const PASSWORD_RECOVERY_COOKIE = "mini_pos_password_recovery"
const PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60

type CookieReader = {
  get(name: string): { value: string } | undefined
}

type MutableCookieStore = CookieReader & {
  set(options: {
    name: string
    value: string
    httpOnly: boolean
    maxAge: number
    path: string
    sameSite: "lax"
    secure: boolean
  }): void
}

function getPasswordRecoveryCookieOptions(maxAge: number) {
  return {
    name: PASSWORD_RECOVERY_COOKIE,
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

export function hasPasswordRecoveryCookie(cookieStore: CookieReader) {
  return cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1"
}

export function writePasswordRecoveryCookie(cookieStore: MutableCookieStore) {
  cookieStore.set({
    ...getPasswordRecoveryCookieOptions(
      PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS
    ),
    value: "1",
  })
}

export function clearPasswordRecoveryCookie(cookieStore: MutableCookieStore) {
  cookieStore.set({
    ...getPasswordRecoveryCookieOptions(0),
    value: "",
  })
}

export const MAGIC_LINK_COOLDOWN_SECONDS = 250
export const MAGIC_LINK_COOLDOWN_STORAGE_KEY =
  "mini-pos-magic-link-cooldown-until"

export function readMagicLinkCooldownUntil(): number | null {
  if (typeof window === "undefined") {
    return null
  }

  const storedValue = window.localStorage.getItem(
    MAGIC_LINK_COOLDOWN_STORAGE_KEY
  )
  const parsedValue = Number(storedValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= Date.now()) {
    window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY)
    return null
  }

  return parsedValue
}

export function setMagicLinkCooldownUntil(until: number) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY, String(until))
}

export function clearMagicLinkCooldown() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY)
}

export function startMagicLinkCooldown() {
  const until = Date.now() + MAGIC_LINK_COOLDOWN_SECONDS * 1000
  setMagicLinkCooldownUntil(until)
  return until
}

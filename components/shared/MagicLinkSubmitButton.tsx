"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  MAGIC_LINK_COOLDOWN_SECONDS,
  clearMagicLinkCooldown,
  readMagicLinkCooldownUntil,
  setMagicLinkCooldownUntil,
} from "@/lib/magicLinkCooldown"

type MagicLinkSubmitButtonProps = {
  disabled?: boolean
  sent?: boolean
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function MagicLinkSubmitButton({
  disabled = false,
  sent = false,
}: MagicLinkSubmitButtonProps) {
  const { pending } = useFormStatus()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    if (searchParams.get("signedOut") === "1") {
      clearMagicLinkCooldown()
      setCooldownUntil(null)
      setRemainingSeconds(0)

      const nextSearchParams = new URLSearchParams(searchParams.toString())
      nextSearchParams.delete("signedOut")

      const nextUrl = nextSearchParams.toString()
        ? `${pathname}?${nextSearchParams.toString()}`
        : pathname

      router.replace(nextUrl, { scroll: false })
      return
    }

    const storedCooldownUntil = readMagicLinkCooldownUntil()

    if (storedCooldownUntil) {
      setCooldownUntil(storedCooldownUntil)
      setRemainingSeconds(
        Math.max(0, Math.ceil((storedCooldownUntil - Date.now()) / 1000))
      )
    }
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!sent) {
      return
    }

    const existingCooldownUntil = readMagicLinkCooldownUntil()
    const nextCooldownUntil =
      existingCooldownUntil ?? Date.now() + MAGIC_LINK_COOLDOWN_SECONDS * 1000

    setMagicLinkCooldownUntil(nextCooldownUntil)
    setCooldownUntil(nextCooldownUntil)
    setRemainingSeconds(
      Math.max(0, Math.ceil((nextCooldownUntil - Date.now()) / 1000))
    )

    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete("sent")

    const nextUrl = nextSearchParams.toString()
      ? `${pathname}?${nextSearchParams.toString()}`
      : pathname

    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams, sent])

  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingSeconds(0)
      return
    }

    const updateRemainingTime = () => {
      const nextRemainingSeconds = Math.max(
        0,
        Math.ceil((cooldownUntil - Date.now()) / 1000)
      )

      setRemainingSeconds(nextRemainingSeconds)

      if (nextRemainingSeconds === 0) {
        setCooldownUntil(null)
        clearMagicLinkCooldown()
      }
    }

    updateRemainingTime()

    const intervalId = window.setInterval(updateRemainingTime, 1000)

    return () => window.clearInterval(intervalId)
  }, [cooldownUntil])

  const isCooldownActive = remainingSeconds > 0
  const isDisabled = disabled || pending || isCooldownActive
  const buttonLabel = useMemo(() => {
    if (pending) {
      return "Sending Magic Link..."
    }

    if (isCooldownActive) {
      return `Send Again in ${formatRemainingTime(remainingSeconds)}`
    }

    return "Send Magic Link"
  }, [isCooldownActive, pending, remainingSeconds])

  return (
    <Button
      type="submit"
      size="lg"
      disabled={isDisabled}
      aria-busy={pending}
      className="group flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold shadow-candy transition-all hover:brightness-110 active:scale-[0.98] disabled:active:scale-100"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{buttonLabel}</span>
        </>
      ) : (
        <>
          <span>{buttonLabel}</span>
          {!isCooldownActive ? (
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          ) : null}
        </>
      )}
    </Button>
  )
}

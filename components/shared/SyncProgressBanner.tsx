"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, CloudDownload } from "lucide-react"
import { cn } from "@/lib/utils"

export type SyncProgress = {
  step: number
  totalSteps: number
  label: string
}

type SyncProgressBannerProps = {
  progress: SyncProgress | null
  className?: string
}

export function SyncProgressBanner({
  progress,
  className,
}: SyncProgressBannerProps) {
  const [visible, setVisible] = useState(false)
  const [doneVisible, setDoneVisible] = useState(false)

  const isComplete = progress !== null && progress.step >= progress.totalSteps
  const percentage = progress
    ? Math.round((progress.step / progress.totalSteps) * 100)
    : 0

  // Show the banner when progress starts, hide with delay after done
  useEffect(() => {
    if (progress && !isComplete) {
      setVisible(true)
      setDoneVisible(false)
    }

    if (isComplete) {
      setDoneVisible(true)
      const hideTimer = setTimeout(() => {
        setVisible(false)
        setDoneVisible(false)
      }, 2500)
      return () => clearTimeout(hideTimer)
    }
  }, [progress, isComplete])

  if (!visible && !progress) {
    return null
  }

  if (!visible) {
    return null
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-500",
        doneVisible ? "bg-success/10" : "bg-primary/5 backdrop-blur-sm",
        className
      )}
    >
      <progress
        aria-label="Offline data sync progress"
        className={cn(
          "[&::-webkit-progress-bar]:bg-primary/10 absolute inset-x-0 bottom-0 h-1 w-full appearance-none overflow-hidden [&::-moz-progress-bar]:transition-all [&::-webkit-progress-value]:transition-all",
          doneVisible
            ? "[&::-moz-progress-bar]:bg-success [&::-webkit-progress-value]:bg-success"
            : "[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary"
        )}
        max={100}
        value={percentage}
      />

      {/* Content */}
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        {doneVisible ? (
          <>
            <CheckCircle2 className="animate-in zoom-in-50 text-success h-3.5 w-3.5 duration-300" />
            <span className="text-success text-xs font-semibold">
              Offline data ready — you can safely go offline
            </span>
          </>
        ) : (
          <>
            <CloudDownload className="text-primary h-3.5 w-3.5 animate-pulse" />
            <span className="text-primary/80 text-xs font-semibold">
              {progress?.label ?? "Preparing offline data\u2026"}
            </span>
            <span className="text-muted-foreground ml-1 text-[0.65rem] font-bold">
              {progress?.step ?? 0}/{progress?.totalSteps ?? 0}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

import { publicEnv } from "@/lib/env"
import { cn } from "@/lib/utils"

type AppWordmarkProps = {
  align?: "center" | "left"
  className?: string
  eyebrow?: string
}

export function AppWordmark({
  align = "left",
  className,
  eyebrow = "Offline-first POS foundation",
}: AppWordmarkProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
        {eyebrow}
      </span>
      <h1 className="font-heading text-3xl text-foreground sm:text-4xl">
        {publicEnv.appName}
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
        A warm, reliable point-of-sale workspace for every booth, shift, and sale.
      </p>
    </div>
  )
}

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "focus-visible:ring-ring/50 disabled:bg-input/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 border-input bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring h-11 w-full min-w-0 rounded-[calc(var(--radius)-0.25rem)] border px-3.5 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

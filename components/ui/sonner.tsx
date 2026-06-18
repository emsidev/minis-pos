"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-panel group-[.toaster]:rounded-3xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-bold group-[.toast]:rounded-full",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:font-bold group-[.toast]:rounded-full",
          success: "group-[.toast]:text-success",
          error: "group-[.toast]:text-destructive",
          warning: "group-[.toast]:text-warning",
          info: "group-[.toast]:text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

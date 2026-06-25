import { Loader2 } from "lucide-react"

export default function AdminLoading() {
  return (
    <div className="app-page-center">
      <div className="app-panel flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-foreground text-lg font-semibold">
            Loading admin data
          </p>
          <p className="text-muted-foreground text-sm leading-6">
            Fetching the latest updates.
          </p>
        </div>
      </div>
    </div>
  )
}

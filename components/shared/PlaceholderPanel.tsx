import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PlaceholderPanelProps = {
  bullets: string[]
  description: string
  eyebrow: string
  title: string
}

export function PlaceholderPanel({
  bullets,
  description,
  eyebrow,
  title,
}: PlaceholderPanelProps) {
  return (
    <Card className="rounded-[2rem] border border-border bg-card/95 shadow-[0_18px_48px_-32px_rgba(26,26,26,0.4)]">
      <CardHeader className="flex flex-col gap-3">
        <Badge variant="secondary">{eyebrow}</Badge>
        <div className="flex flex-col gap-2">
          <CardTitle className="font-heading text-2xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

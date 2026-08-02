import { ArrowRight } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Card, CardContent } from "@openota/ui/card";

interface NextStepCardProps {
  /** What the user just accomplished, e.g. "You've created your project." */
  accomplished: string;
  /** What to do next, e.g. "Generate an API key to connect the CLI." */
  next: string;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
}

/** The "what do I do now" card — every page in the setup flow should end with one of these so the
 * user is never left staring at a screen wondering what comes next. */
export function NextStepCard({ accomplished, next, actionLabel, onAction, href }: NextStepCardProps) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div>
          <p className="text-sm text-muted-foreground">{accomplished}</p>
          <p className="text-sm font-medium">Next: {next}</p>
        </div>
        <Button size="sm" onClick={onAction} asChild={Boolean(href)}>
          {href ? (
            <a href={href}>
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <>
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@openota/ui/tooltip";

/** The (ⓘ) next to a technical field label — click/hover to explain what the value is and where
 * it's used. Every ID/key/version field a first-time user might not recognize should have one. */
export function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/70 hover:text-foreground" aria-label="More info">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

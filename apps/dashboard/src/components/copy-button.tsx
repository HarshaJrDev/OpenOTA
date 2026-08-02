"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@openota/ui/button";

import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: "icon" | "sm";
}

/**
 * The one copy-to-clipboard implementation for the whole dashboard — previously api-keys/page.tsx
 * and sdk-config-card.tsx each hand-rolled their own (one with a toggling icon, one with no
 * feedback at all). Every "copy this value" affordance in the app should use this.
 */
export function CopyButton({ value, label = "value", className, size = "icon" }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  /**
   * navigator.clipboard is unavailable in some contexts (non-secure origin, certain embedded
   * webviews, denied permission) — falls back to the older execCommand approach rather than
   * failing outright. Either way, always resolves/rejects with visible feedback: previously a
   * clipboard failure here produced neither a success nor an error toast, so "Copy" silently did
   * nothing and looked indistinguishable from the button being broken.
   */
  function legacyCopy(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!legacyCopy(value)) {
        throw new Error("copy command was rejected");
      }
      setCopied(true);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Couldn't copy ${label} — select and copy the text manually`);
    }
  }

  if (size === "sm") {
    return (
      <Button variant="outline" size="sm" onClick={handleCopy} className={cn("gap-1.5", className)}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn("h-7 w-7 shrink-0", className)}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

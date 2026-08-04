"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@openota/ui/button";
import { cn } from "@openota/ui/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

/**
 * navigator.clipboard is unavailable in some contexts (non-secure origin, certain embedded
 * webviews) — falls back to the older execCommand approach rather than silently doing nothing.
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

/** The one copy-to-clipboard implementation for the marketing/docs site — every command, path, ID, or config value should use this instead of a bare `<pre>`. */
export function CopyButton({ value, label = "value", className }: CopyButtonProps) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!legacyCopy(value)) {
        throw new Error("copy command was rejected");
      }
      setState("copied");
    } catch {
      setState("failed");
    } finally {
      setTimeout(() => setState("idle"), 1500);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
      aria-label={state === "failed" ? `Couldn't copy ${label}` : `Copy ${label}`}
      title={state === "failed" ? "Couldn't copy — select the text manually" : `Copy ${label}`}
    >
      {state === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

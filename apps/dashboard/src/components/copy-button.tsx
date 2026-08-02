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

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(false), 1500);
    });
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

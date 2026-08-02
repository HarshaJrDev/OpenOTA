import { CopyButton } from "@/components/copy-button";
import { InfoTooltip } from "@/components/info-tooltip";

interface CopyFieldProps {
  label: string;
  value: string;
  /** Shown in the "Copied ___" toast, e.g. "Project ID" — defaults to `label`. */
  copyLabel?: string;
  /** Explanation shown in the (ⓘ) tooltip — what this value is / where it's used. */
  help?: React.ReactNode;
  /** One-line caption under the value, e.g. "Used by openota.config.json". */
  description?: string;
  mono?: boolean;
}

/** The one "labeled value with a copy button" row used for Project ID, Server URL, Runtime
 * Version, Package Name, Bundle Identifier, etc. — every place a developer needs to grab a
 * technical value verbatim, with an explanation of what it is right next to it. */
export function CopyField({ label, value, copyLabel, help, description, mono = true }: CopyFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          {help && <InfoTooltip>{help}</InfoTooltip>}
        </div>
        <div className={mono ? "mt-0.5 truncate font-mono text-sm" : "mt-0.5 truncate text-sm"}>{value}</div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <CopyButton value={value} label={copyLabel ?? label} className="mt-0.5" />
    </div>
  );
}

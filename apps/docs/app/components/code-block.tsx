import { cn } from "@openota/ui/lib/utils";

import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  label?: string;
  className?: string;
  preClassName?: string;
}

/** A `<pre><code>` block with a copy button pinned to the top-right corner — the one code-block shell every page should render commands/config through instead of a bare `<pre>`. */
export function CodeBlock({ code, label = "command", className, preClassName }: CodeBlockProps) {
  return (
    <div className={cn("group relative", className)}>
      <pre className={cn("overflow-x-auto p-5 pr-12 font-mono text-sm leading-relaxed", preClassName)}>
        <code>{code}</code>
      </pre>
      <CopyButton value={code} label={label} className="absolute right-2 top-2" />
    </div>
  );
}

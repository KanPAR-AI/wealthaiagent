// components/memory/untrusted-text.tsx — renders memory/evidence text as
// INERT, quoted, untrusted data (UI_SPEC §16, T24; security-boundaries).
// The engine already treats memory as data, not instructions; the UI must
// not undo that by re-parsing memory text as markdown/HTML/commands. React
// escapes by default, so rendering the string in a text node is already
// safe from injection — this component makes the "this is quoted data, not
// an instruction" framing EXPLICIT and visible, and guarantees no markdown/
// HTML renderer ever touches the content.
import { cn } from "@/lib/utils";
import { Quote } from "lucide-react";

interface UntrustedTextProps {
  children: string;
  /** a short label for what this quoted content is, e.g. "User message". */
  sourceLabel?: string;
  className?: string;
  /** render as an inline inert quote (for short values inside a sentence)
   *  rather than a block figure. Still a plain escaped text node — no
   *  markdown/HTML renderer, same T24 guarantee. */
  inline?: boolean;
}

export function UntrustedText({ children, sourceLabel, className, inline }: UntrustedTextProps) {
  if (inline) {
    // Inline inert quote: a plain text node in a styled span. React escapes
    // it; an instruction-shaped string appears verbatim as quoted data.
    return (
      <span
        className={cn(
          "rounded bg-muted/40 px-1 font-medium text-foreground/90",
          className,
        )}
        aria-label={sourceLabel ? `Quoted ${sourceLabel} (data, not an instruction)` : "Quoted content (data, not an instruction)"}
        data-testid="untrusted-text-inline"
      >
        {children}
      </span>
    );
  }
  return (
    <figure
      className={cn(
        "rounded-md border border-border/60 bg-muted/30 p-3",
        className,
      )}
      // Announce to AT that this is quoted evidence, not app instruction.
      aria-label={sourceLabel ? `Quoted ${sourceLabel} (data, not an instruction)` : "Quoted content (data, not an instruction)"}
      data-testid="untrusted-text"
    >
      <div className="flex gap-2">
        <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {/* The content is a plain text node — React escapes it; NO markdown,
            NO dangerouslySetInnerHTML, NO html renderer. An instruction-
            shaped string like "Ignore previous instructions" appears
            verbatim as quoted data and changes no behavior. */}
        <blockquote className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground/90">
          {children}
        </blockquote>
      </div>
    </figure>
  );
}

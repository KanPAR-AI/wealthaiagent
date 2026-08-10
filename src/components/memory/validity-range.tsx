// components/memory/validity-range.tsx — ValidityRange leaf (COMPONENT_MODEL
// shared/leaf list). Renders `[valid_from, valid_until)` — inclusive
// from, exclusive until (AMB-2) — as plain text. Pure formatting of the
// engine's own fields; computes no temporal-validity TRUTH (STATE_MODEL:
// "is this valid now" stays server-side).
export interface ValidityRangeProps {
  validFrom?: string | null;
  validUntil?: string | null;
  className?: string;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ValidityRange({ validFrom, validUntil, className }: ValidityRangeProps) {
  const from = formatDate(validFrom);
  const until = formatDate(validUntil);

  if (!from && !until) {
    return (
      <span className={className} data-testid="validity-range">
        Always valid
      </span>
    );
  }

  return (
    <span className={className} data-testid="validity-range">
      {from ?? "the start"} – {until ?? "ongoing"}
    </span>
  );
}

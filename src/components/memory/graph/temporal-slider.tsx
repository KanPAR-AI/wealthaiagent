// components/memory/graph/temporal-slider.tsx — TemporalSlider (UI_SPEC
// §27-30, UI-16/TEMP-03). Picks a point-in-time `at` value; the PARENT
// re-fetches the neighborhood at that instant (the engine's own temporal
// validity via Relation.is_valid_at, never a client computation of what's
// "valid now" — STATE_MODEL). A native <input type="range"> — keyboard
// operable (arrow keys) with zero new dependency (no Slider primitive
// exists in components/ui yet).
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TemporalSliderProps {
  /** ISO timestamp, or undefined/null for "now" (no temporal filter). */
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  /** Range bounds, ISO timestamps. Defaults to 5 years ago .. now — a
   *  display convenience, not a memory semantic (the engine still decides
   *  validity for whatever instant is picked). */
  fromIso?: string;
  toIso?: string;
  className?: string;
}

const MS_PER_DAY = 86_400_000;

export function TemporalSlider({ value, onChange, fromIso, toIso, className }: TemporalSliderProps) {
  const from = useMemo(() => (fromIso ? new Date(fromIso).getTime() : Date.now() - 5 * 365 * MS_PER_DAY), [fromIso]);
  const to = useMemo(() => (toIso ? new Date(toIso).getTime() : Date.now()), [toIso]);
  const current = value ? new Date(value).getTime() : to;
  const clamped = Math.min(to, Math.max(from, current));

  return (
    <div className={className} data-testid="temporal-slider">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <label htmlFor="graph-temporal-slider" className="font-medium">
          As of
        </label>
        <span data-testid="temporal-slider-value">{value ? new Date(value).toLocaleDateString() : "Now"}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="graph-temporal-slider"
          type="range"
          min={from}
          max={to}
          step={MS_PER_DAY}
          value={clamped}
          aria-label="Point in time for the graph"
          aria-valuetext={value ? new Date(value).toLocaleDateString() : "Now"}
          onChange={(e) => {
            const ts = Number(e.target.value);
            // snapped to "now" (within a day) reads as no temporal filter,
            // matching the honest "Now" state rather than a near-miss ISO
            onChange(ts >= to - MS_PER_DAY ? null : new Date(ts).toISOString());
          }}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onChange(null)}
          disabled={!value}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Now
        </Button>
      </div>
    </div>
  );
}

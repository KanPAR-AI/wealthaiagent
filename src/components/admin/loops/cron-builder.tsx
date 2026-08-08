/**
 * Cron builder (docs/37 §5.3, design spec screen 5): plain-language presets
 * first, raw cron second; ALWAYS shows the expression, its field breakdown,
 * and the next 3 fire times in BOTH the admin's local timezone and UTC (UTC
 * is never hidden — schedules are one of the worst places for ambiguity).
 * Validation is live, never deferred to Save. The matcher is the TS port of
 * the engine's, tested on the same vectors, so this preview cannot disagree
 * with what actually fires.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Cron, cronError, CRON_PRESETS, describeCron } from "@/lib/loop-stack/cron";

export function CronBuilder({ value, onChange }: {
  value: string;
  onChange: (cron: string) => void;
}) {
  const [preset, setPreset] = useState<string>(() => guessPreset(value));
  const [hour, setHour] = useState(() => partOf(value, "hour"));
  const [minute, setMinute] = useState(() => partOf(value, "minute"));
  const [everyN, setEveryN] = useState(30);

  const error = cronError(value);
  const fires = useMemo(() => {
    if (error) return [];
    try {
      return new Cron(value).nextFires(new Date(), 3);
    } catch {
      return [];
    }
  }, [value, error]);

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";

  const applyPreset = (id: string, h = hour, m = minute, n = everyN) => {
    setPreset(id);
    const p = CRON_PRESETS.find((x) => x.id === id);
    const built = p?.build({ hour: h, minute: m, everyN: n });
    if (built) onChange(built);
  };

  const fields = value.trim().split(/\s+/);

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Schedule</p>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Schedule preset">
        {CRON_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={preset === p.id}
            onClick={() => applyPreset(p.id)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              preset === p.id ? "border-primary ring-1 ring-primary/40" : "border-border/60 hover:bg-accent/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(preset === "daily" || preset === "weekdays" || preset === "hourly") && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {preset !== "hourly" && (
            <>
              <label className="sr-only" htmlFor="cron-hour">Hour</label>
              <input
                id="cron-hour" type="number" min={0} max={23} value={hour}
                onChange={(e) => {
                  const h = clamp(Number(e.target.value), 0, 23);
                  setHour(h); applyPreset(preset, h, minute);
                }}
                className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center tabular-nums"
              />
              <span>:</span>
            </>
          )}
          <label className="sr-only" htmlFor="cron-minute">Minute</label>
          <input
            id="cron-minute" type="number" min={0} max={59} value={minute}
            onChange={(e) => {
              const m = clamp(Number(e.target.value), 0, 59);
              setMinute(m); applyPreset(preset, hour, m);
            }}
            className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center tabular-nums"
          />
          <span className="text-muted-foreground">UTC {preset === "hourly" ? "past each hour" : ""}</span>
        </div>
      )}
      {preset === "interval" && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          Every
          <input
            type="number" min={1} max={59} value={everyN}
            onChange={(e) => {
              const n = clamp(Number(e.target.value), 1, 59);
              setEveryN(n); applyPreset("interval", hour, minute, n);
            }}
            className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center tabular-nums"
          />
          minutes
        </label>
      )}

      <div className="mt-3">
        <label htmlFor="cron-expr" className="text-xs text-muted-foreground">Cron expression</label>
        <input
          id="cron-expr"
          value={value}
          onChange={(e) => { setPreset("custom"); onChange(e.target.value); }}
          className={cn(
            "mt-0.5 block w-48 rounded-md border bg-background px-2 py-1 font-mono text-xs",
            error ? "border-destructive" : "border-input",
          )}
          aria-invalid={Boolean(error)}
        />
        <div className="mt-0.5 flex w-56 justify-between font-mono text-[10px] text-muted-foreground">
          <span>min</span><span>hour</span><span>day</span><span>month</span><span>weekday</span>
        </div>
        {fields.length === 5 && (
          <div className="flex w-56 justify-between font-mono text-[10px]">
            {fields.map((f, i) => <span key={i}>{f}</span>)}
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-2 text-xs text-destructive" role="alert">
          × {error}
          <p className="mt-0.5 text-muted-foreground">Next runs unavailable until the expression is valid.</p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xs font-medium">✓ {describeCron(value)}</p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Local — {localTz}
              </p>
              <ul className="mt-0.5 space-y-0.5 text-xs tabular-nums">
                {fires.map((d) => (
                  <li key={d.toISOString()}>
                    {d.toLocaleString(undefined, {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">UTC</p>
              <ul className="mt-0.5 space-y-0.5 text-xs tabular-nums">
                {fires.map((d) => (
                  <li key={d.toISOString()}>
                    {d.toLocaleString("en-GB", {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            ℹ Runs that miss their scheduled slot by more than 15 minutes are skipped.
          </p>
        </div>
      )}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : lo;
}

function partOf(cron: string, part: "hour" | "minute"): number {
  const f = cron.trim().split(/\s+/);
  const v = Number(part === "minute" ? f[0] : f[1]);
  return Number.isInteger(v) ? v : part === "hour" ? 9 : 0;
}

function guessPreset(cron: string): string {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return "daily";
  if (f[0].startsWith("*/")) return "interval";
  if (f[4] === "1-5" && f[2] === "*") return "weekdays";
  if (f[1] === "*" && f[2] === "*" && f[3] === "*" && f[4] === "*") return "hourly";
  if (f[2] === "*" && f[3] === "*" && f[4] === "*") return "daily";
  return "custom";
}

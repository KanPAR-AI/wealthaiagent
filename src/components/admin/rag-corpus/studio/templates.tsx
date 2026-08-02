// Templates — the rail's second section.
//
// A template is a starting SCHEMA: the fields a corpus of this kind usually
// needs. It is a head start on the interview, not a replacement for it, and the
// panel says so — the fields a corpus actually needs come from what it is for,
// and a template that gets treated as the answer produces a corpus shaped like
// the average of everything rather than like the thing somebody wanted.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchTemplates } from "@/services/corpus-video-service";

export function TemplatesPanel({
  onUse,
}: {
  onUse?: (key: string) => void;
}) {
  const [rows, setRows] = useState<{ key: string; fields: string[] }[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setRows((await fetchTemplates()).templates);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="max-w-2xl text-xs text-muted-foreground">
          The fields a corpus of each kind usually needs. A starting point for
          the interview, not a substitute for it — what a corpus actually needs
          comes from what it is for.
        </p>
      </div>

      {busy && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> loading…
        </p>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <div key={t.key} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium capitalize">{t.key.replace(/_/g, " ")}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.fields.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
            {onUse && (
              <button
                onClick={() => onUse(t.key)}
                className="mt-2.5 text-[11px] font-medium text-primary hover:underline"
              >
                Start a corpus from this
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

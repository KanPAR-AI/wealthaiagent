/**
 * Report a loops bug (docs/38 addendum): the admin writes one line; the Loop
 * Assistant gathers the diagnostics (spec, activation problems, recent runs
 * with failure notes, the named run, eval scorecards) and drafts the report.
 * It lands in the SAME pipeline as user bug reports — /admin/bugs, the
 * fix-bug-report skill — with diagnostics frozen onto the report.
 */

import { Bug, Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportLoopBug } from "@/services/loops-service";

export function LoopBugFlag({ loopId, runId, context }: {
  loopId?: string;
  runId?: string;
  /** Wizard state when reporting from the create flow (no loop yet). */
  context?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ id: string; description: string } | null>(null);

  const submit = async () => {
    if (description.trim().length < 3 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await reportLoopBug(description.trim(), { loopId, runId, context });
      setFiled({ id: res.id, description: res.description });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not file the report");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setDescription("");
    setErr(null);
    setFiled(null);
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label={loopId ? `Report a bug about loop ${loopId}` : "Report a loops bug"}
      >
        <Bug size={14} /> Report bug
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug size={16} /> Report a loops bug
            </DialogTitle>
            <DialogDescription>
              {loopId
                ? <>About <span className="font-mono">{loopId}</span>{runId ? <> · run <span className="font-mono">{runId.slice(0, 8)}</span></> : null}. </>
                : "About the create flow. "}
              Describe the problem in a line — the Loop Assistant attaches the
              full diagnostics (spec, problems, run errors) automatically.
            </DialogDescription>
          </DialogHeader>

          {!filed ? (
            <>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. The schedule shows next-fire times but nothing ran this morning"
                autoFocus
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
                <Button size="sm" disabled={busy || description.trim().length < 3} onClick={submit}>
                  {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                  {busy ? "Assistant is gathering diagnostics…" : "File report"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <Check size={14} /> Report <span className="font-mono">{filed.id.slice(0, 8)}</span> filed with diagnostics attached.
              </p>
              <details className="rounded-md border border-border bg-muted/30 p-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  What the assistant wrote
                </summary>
                <pre className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs">
                  {filed.description}
                </pre>
              </details>
              <div className="flex justify-end">
                <Button size="sm" onClick={reset}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Who can read this corpus.
 *
 * WHY THIS EXISTS
 *
 * `PUT /admin/corpus/{id}/readers` has worked for weeks. `setCorpusReaders()`
 * has been exported from corpus-video-service.ts for just as long — and was
 * called by nothing. Every surface that touched readers only DISPLAYED them:
 * the library panel printed them as text, the corpus card showed a count, and
 * the wizard's finish screen advised "Set readers on the corpus" next to no
 * control that could.
 *
 * So the last step of building a corpus was completable by curl and not by a
 * person, and a corpus that nothing can retrieve from looks identical to a
 * working one until somebody asks it a question. That is the same shape as the
 * original defect the whole publish-verification chain was built to catch,
 * surviving one layer further out — in the UI rather than in the pipeline.
 *
 * The subscription lives on the CORPUS, not on the agent (docs/21 §2): one
 * record answers "who reads this?", which is the question somebody asks before
 * editing content. So this control belongs here, beside the corpus, and not in
 * each agent's settings.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Users } from "lucide-react";

import { fetchAgents } from "@/services/admin-service";
import { setCorpusReaders } from "@/services/corpus-video-service";

interface Props {
  corpusId: string;
  readers: string[];
  /** Published corpora can actually be read; unpublished ones cannot, and
   *  saying so here stops "I subscribed it and nothing happened". */
  published?: boolean;
  onChange?: (readers: string[]) => void;
  compact?: boolean;
}

export function ReadersPicker({
  corpusId,
  readers,
  published = true,
  onChange,
  compact = false,
}: Props) {
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>(readers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(0);

  // Keyed on the VALUE, not the array identity: the parent rebuilds the list
  // on every render, and depending on the reference would reset a half-made
  // selection under the person making it.
  const readersKey = readers.join("|");
  useEffect(() => setSelected(readersKey ? readersKey.split("|") : []), [readersKey]);

  useEffect(() => {
    let alive = true;
    fetchAgents()
      .then((r) => {
        if (!alive) return;
        setAgents(
          (r.agents || []).map((a: { id?: string; agent_id?: string; name?: string }) => ({
            id: String(a.id || a.agent_id || ""),
            name: String(a.name || a.id || a.agent_id || ""),
          })).filter((a) => a.id),
        );
      })
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => {
    const a = [...selected].sort().join("|");
    const b = [...readers].sort().join("|");
    return a !== b;
  }, [selected, readers]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await setCorpusReaders(corpusId, selected);
      // Trust the SERVER's list, not the local one: it deduplicates and keeps
      // order stable, and showing the optimistic version would hide that.
      setSelected(res.readers || []);
      onChange?.(res.readers || []);
      setSavedAt(Date.now());
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Users size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium">Which agents can read this</span>
      </div>

      {!compact && (
        <p className="mb-3 text-xs text-muted-foreground">
          An agent that does not subscribe cannot retrieve from this corpus, no
          matter how well it is indexed. Several agents can read the same corpus
          — it is not copied for each one.
        </p>
      )}

      {selected.length === 0 && (
        <div className="mb-3 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            Nothing subscribes to this corpus yet, so nothing can answer from it.
          </span>
        </div>
      )}

      {!published && selected.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            Subscribed, but this corpus is not published — there are no vectors
            to retrieve yet. Publish it and these agents will pick it up.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" data-testid="readers-options">
        {agents.length === 0 && !error && (
          <span className="text-xs text-muted-foreground">Loading agents…</span>
        )}
        {agents.map((a) => {
          const on = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              data-testid={`reader-${a.id}`}
              aria-pressed={on}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                on
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {on && <Check size={11} />}
              {a.name}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          data-testid="save-readers"
          className="flex items-center gap-1.5 rounded border border-border/60 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? "Saving…" : "Save subscriptions"}
        </button>
        {!dirty && savedAt > 0 && (
          <span className="text-xs text-emerald-400" data-testid="readers-saved">
            Saved — {selected.length || "no"} agent
            {selected.length === 1 ? "" : "s"} can read this.
          </span>
        )}
      </div>
    </div>
  );
}

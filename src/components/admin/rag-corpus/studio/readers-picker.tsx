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
import {
  createAgentForCorpus,
  setCorpusReaders,
  updateAgentPrompt,
} from "@/services/corpus-video-service";

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
  const [making, setMaking] = useState(false);
  const [made, setMade] = useState<
    { id: string; name: string; queries: string[] } | null
  >(null);
  // The drafted prompt, editable HERE. A prompt somebody has to hunt for in
  // another tab is a prompt nobody reads before it starts answering.
  const [prompt, setPrompt] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

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

  async function makeOne() {
    setMaking(true);
    setError("");
    try {
      const r = await createAgentForCorpus(corpusId);
      setSelected(r.readers || []);
      onChange?.(r.readers || []);
      setMade({ id: r.agent_id, name: r.name, queries: r.example_queries || [] });
      setPrompt(r.system_prompt || "");
      setPromptSaved(false);
      // The new agent has to appear in the list, or it reads as not created.
      const a = await fetchAgents();
      setAgents(
        (a.agents || []).map((x: { id?: string; agent_id?: string; name?: string }) => ({
          id: String(x.id || x.agent_id || ""),
          name: String(x.name || x.id || x.agent_id || ""),
        })).filter((x) => x.id),
      );
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setMaking(false);
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

      {/* NONE OF THESE FIT is a normal answer, and it used to be a dead end:
          the corpus sat unreachable while somebody went to the builder and
          described from memory the thing they had just finished building.
          Everything that draft needs is already on this corpus. */}
      <div className="mt-3 rounded border border-dashed border-border/60 p-2.5">
        <p className="text-xs">None of these fit?</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Draft one from this corpus — its purpose, what the documents are
          about, and the questions you said it must answer.
        </p>
        <button
          type="button"
          onClick={() => void makeOne()}
          disabled={making}
          data-testid="create-agent-for-corpus"
          className="mt-2 flex items-center gap-1.5 rounded border border-border/60 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {making && <Loader2 size={12} className="animate-spin" />}
          {making ? "Drafting…" : "Create an agent for this corpus"}
        </button>
        {made && (
          <div className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/5 p-2 text-[11px]">
            <p className="font-medium">
              <Check size={11} className="mr-1 inline" />
              {made.name} — created as a draft and subscribed
            </p>
            <p className="mt-1 text-muted-foreground">
              Review its prompt and routing before activating it. It will
              answer only from this corpus.
            </p>
            {/* EDITABLE, on the page that produced it. The agent is a draft
                and its prompt is a first attempt — reviewing it is the step
                between "an agent exists" and "an agent should answer people". */}
            {prompt && (
              <div className="mt-2">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Its prompt — edit before you activate it
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setPromptSaved(false);
                  }}
                  rows={6}
                  data-testid="drafted-prompt"
                  className="mt-1 w-full rounded border border-border/60 bg-background px-2 py-1.5 text-[11px] leading-relaxed"
                />
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingPrompt || promptSaved || !prompt.trim()}
                    data-testid="save-drafted-prompt"
                    onClick={async () => {
                      setSavingPrompt(true);
                      try {
                        await updateAgentPrompt(made.id, prompt);
                        setPromptSaved(true);
                      } catch (e) {
                        setError(String((e as Error)?.message || e));
                      } finally {
                        setSavingPrompt(false);
                      }
                    }}
                    className="rounded border border-border/60 px-2 py-1 text-[11px] disabled:opacity-40"
                  >
                    {savingPrompt ? "Saving…" : promptSaved ? "Saved" : "Save prompt"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    Every save is a version — nothing is lost.
                  </span>
                </div>
              </div>
            )}

            {made.queries.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                {made.queries.slice(0, 3).map((q) => (
                  <li key={q} className="truncate">· {q}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

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

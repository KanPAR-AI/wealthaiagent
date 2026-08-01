// Delegate corpus labelling to a person.
//
// The panel is deliberately two screens rather than one: an owner picks the
// batch and writes the spec, a labeller opens a worksheet and does nothing but
// answer it. Mixing them puts a "change the rules" control next to every field
// a reviewer is filling in, which is how a batch ends up half-labelled under
// one definition and half under another.

import { useCallback, useEffect, useState } from "react";
import { Sparkles, UserPlus, ChevronLeft, Check } from "lucide-react";
import {
  createAssignment,
  getWorksheet,
  labelDocument,
  listAssignments,
  prefill,
  type Assignment,
  type Worksheet,
} from "../../../services/corpus-labelling-service";

interface DraftField {
  name: string;
  instruction: string;
  optionsText: string;
  required: boolean;
}

const EMPTY_FIELD: DraftField = { name: "", instruction: "", optionsText: "", required: true };

export function LabellingPanel({
  corpusId,
  candidateIds,
}: {
  corpusId: string;
  candidateIds: string[];
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [open, setOpen] = useState<Worksheet | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<DraftField[]>([{ ...EMPTY_FIELD }]);
  const [model, setModel] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await listAssignments(corpusId);
      setAssignments(res.assignments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load assignments");
    }
  }, [corpusId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit() {
    setError("");
    const spec = fields
      .filter((f) => f.name.trim() && f.instruction.trim())
      .map((f) => ({
        name: f.name.trim(),
        instruction: f.instruction.trim(),
        options: f.optionsText.split(",").map((o) => o.trim()).filter(Boolean),
        required: f.required,
      }));
    if (!spec.length) {
      // The server enforces this too; saying it here saves a round trip and
      // explains WHY, which a 400 body does not.
      setError("Every field needs a name and an instruction — a labeller cannot be consistent with a rule nobody wrote down.");
      return;
    }
    setBusy("create");
    try {
      await createAssignment(corpusId, {
        title: title || "Labelling batch",
        assignee,
        doc_ids: candidateIds,
        spec: spec as never,
        note,
      });
      setCreating(false);
      setTitle("");
      setAssignee("");
      setNote("");
      setFields([{ ...EMPTY_FIELD }]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not create the assignment");
    } finally {
      setBusy("");
    }
  }

  async function runPrefill(id: string) {
    setBusy("prefill");
    setError("");
    try {
      const res = await prefill(corpusId, id, model);
      // Report what actually happened. "0 suggested, 6 declined" is a useful
      // answer on footage whose name is only on screen; showing "done" there
      // would send someone looking for suggestions that do not exist.
      setError(
        res.suggested
          ? `${res.suggested} document(s) have suggestions to review.`
          : res.note || `Nothing suggested (${res.declined} declined, ${res.failed} failed).`,
      );
      if (open?.assignment.assignment_id === id) setOpen(await getWorksheet(corpusId, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "prefill failed");
    } finally {
      setBusy("");
    }
  }

  async function save(docId: string, field: string, value: string) {
    if (!open) return;
    setError("");
    try {
      await labelDocument(corpusId, open.assignment.assignment_id, docId, field, value);
      setOpen(await getWorksheet(corpusId, open.assignment.assignment_id));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save that label");
    }
  }

  // ── worksheet ────────────────────────────────────────────────────────────
  if (open) {
    const a = open.assignment;
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-medium">{a.title}</h3>
          <span className="text-xs text-muted-foreground">
            {open.progress.done}/{open.progress.found} done
          </span>
          <button
            onClick={() => runPrefill(a.assignment_id)}
            disabled={busy === "prefill"}
            className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            <Sparkles size={12} />
            {busy === "prefill" ? "Asking…" : "AI pre-fill"}
          </button>
        </div>
        {a.note && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{a.note}</p>
        )}
        {error && <p className="text-xs text-amber-600">{error}</p>}

        {open.documents.map((doc) => (
          <div key={doc.id} className="rounded-md border border-border p-3 space-y-2">
            <p className="text-sm font-medium">{doc.title || doc.id}</p>
            {doc.video_file && (
              <p className="text-xs text-muted-foreground">{doc.video_file}</p>
            )}
            {Object.entries(doc.fields).map(([name, f]) => (
              <div key={name} className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-xs text-muted-foreground" title={f.instruction}>
                  {name}
                  {f.required && <span className="text-destructive"> *</span>}
                </span>
                {f.options.length ? (
                  <select
                    value={f.value ?? ""}
                    onChange={(e) => save(doc.id, name, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    defaultValue={f.value ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (f.value ?? "")) save(doc.id, name, e.target.value);
                    }}
                    placeholder={f.instruction}
                    className="flex-1 min-w-40 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                )}
                {f.source === "human" ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check size={12} /> labelled
                  </span>
                ) : f.suggestion ? (
                  // A suggestion is offered, never applied. Accepting it is a
                  // click, and that click is what stamps a person as the source.
                  <button
                    onClick={() => save(doc.id, name, f.suggestion!)}
                    className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    title="AI suggestion — click to accept"
                  >
                    <Sparkles size={10} className="inline mr-1" />
                    {f.suggestion}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── batches ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">Human labelling</h3>
        <span className="text-xs text-muted-foreground">
          {candidateIds.length} document(s) in the current view
        </span>
        <button
          onClick={() => setCreating((v) => !v)}
          disabled={!candidateIds.length}
          className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
        >
          <UserPlus size={12} /> Delegate these
        </button>
      </div>

      {error && <p className="text-xs text-amber-600">{error}</p>}

      {creating && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Batch name"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="labeller@email"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How to label these — e.g. 'the name is on the title card in the first 3 seconds; leave blank rather than guessing from the posture'"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            rows={2}
          />
          {fields.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={f.name}
                onChange={(e) =>
                  setFields((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="field"
                className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                value={f.instruction}
                onChange={(e) =>
                  setFields((p) =>
                    p.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x)),
                  )
                }
                placeholder="what a correct answer means"
                className="flex-1 min-w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                value={f.optionsText}
                onChange={(e) =>
                  setFields((p) =>
                    p.map((x, j) => (j === i ? { ...x, optionsText: e.target.value } : x)),
                  )
                }
                placeholder="options (comma separated, optional)"
                className="w-56 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFields((p) => [...p, { ...EMPTY_FIELD }])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + field
            </button>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="pre-fill model (optional)"
              className="ml-auto w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
            <button
              onClick={submit}
              disabled={busy === "create" || !assignee}
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
            >
              {busy === "create" ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      )}

      {!assignments.length && !creating && (
        <p className="text-xs text-muted-foreground">
          Nothing delegated yet. Filter the library to the documents that need a person, then
          assign them with a spec saying what to label.
        </p>
      )}

      {assignments.map((a) => (
        <button
          key={a.assignment_id}
          onClick={async () => setOpen(await getWorksheet(corpusId, a.assignment_id))}
          className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left hover:bg-muted/50"
        >
          <div className="flex-1">
            <p className="text-sm">{a.title}</p>
            <p className="text-xs text-muted-foreground">
              {a.assignee} · {a.spec.map((f) => f.name).join(", ")}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              a.progress?.state === "done"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {a.progress?.done ?? 0}/{a.progress?.found ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

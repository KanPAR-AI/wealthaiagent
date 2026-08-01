// Create a corpus by saying what it is FOR (CUJ 1).
//
// A corpus used to come into existence by typing an id into an import call. It
// had no name, no owner, and nowhere to record its purpose — which is the field
// everything downstream reads: the schema proposed from it, the retrieval
// contract derived from it, the evaluation questions generated against it.
//
// The form asks the two questions that change what a good corpus looks like,
// and nothing else is required. A mandatory field somebody has to invent a
// value for is a field full of invented values.

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCorpus,
  fetchTemplates,
  type NewCorpusInput,
} from "@/services/corpus-video-service";

export function CreateCorpus({
  onCreated,
}: {
  onCreated: (corpusId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewCorpusInput>({
    name: "", purpose: "", description: "", audience: "", template: "general",
  });
  const [questions, setQuestions] = useState("");
  const [templates, setTemplates] = useState<{ key: string; fields: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && !templates.length) {
      fetchTemplates().then((r) => setTemplates(r.templates)).catch(() => {});
    }
  }, [open, templates.length]);

  const seeded = templates.find((t) => t.key === form.template)?.fields ?? [];

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const out = await createCorpus({
        ...form,
        typical_questions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
      });
      setOpen(false);
      setForm({ name: "", purpose: "", description: "", audience: "", template: "general" });
      setQuestions("");
      onCreated(out.corpus.corpus_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1" /> Create corpus
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          New corpus
          <button onClick={() => setOpen(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  aria-label="cancel">
            <X size={14} />
          </button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Knee Rehabilitation"
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          {form.name && (
            // Shown live because the id ends up in Redis index names and
            // Firestore paths — a surprise there is expensive to undo.
            <p className="mt-1 text-[11px] text-muted-foreground">
              id: <span className="font-mono">
                {form.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
                  .replace(/^_+|_+$/g, "").slice(0, 60)}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            What should the assistant built on this be able to do?
          </label>
          <textarea
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            rows={2}
            placeholder="Recommend rehabilitation exercises appropriate to a patient's recovery phase, with a timestamped clip for each."
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Required. Without it there is nothing to propose a schema from, and
            nothing to evaluate the corpus against later.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Who is asking?
            </label>
            <input
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
              placeholder="knee arthritis patients"
              className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              The same footage answers a patient and a clinician differently.
            </p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Domain hint
            </label>
            <select
              value={form.template}
              onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {templates.map((t) => (
                <option key={t.key} value={t.key}>{t.key}</option>
              ))}
            </select>
            {seeded.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                seeds: {seeded.join(", ")} — a starting point, not a constraint
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Questions it must answer (one per line)
          </label>
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={3}
            placeholder={"What exercises are safe in phase 1?\nWhat should I avoid with a replaced knee?"}
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Optional now, but this is the only honest basis for evaluating the
            corpus once it is built.
          </p>
        </div>

        {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy || !form.name.trim() || !form.purpose.trim()}
                  onClick={() => void submit()}>
            {busy && <Loader2 size={12} className="mr-1 animate-spin" />}
            Create
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <span className="text-[11px] text-muted-foreground">
            You can create this before uploading anything — settling the purpose
            first is what lets a schema be proposed for it.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

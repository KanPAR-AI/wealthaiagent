// Write the guidelines once, run them across a batch.
//
// THE POINT IS THE SHARED SPEC, not the convenience. Extracting each video
// separately is how one comes back keyed `equipment`, the next `apparatus` and
// a third `gear` — and a field that exists under three names is three fields
// nobody can filter on. So the spec is loaded from the corpus, applied to the
// whole selection, and saved back.
//
// The dry run is one document on purpose: the failure worth catching is a spec
// that returns the wrong shape, and paying for seventy calls to discover it is
// the expensive way.

import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  extractCorpus,
  fetchExtractionSpec,
  type ExtractionSpec,
} from "@/services/corpus-video-service";

interface Field {
  name: string;
  instruction: string;
}

export function ExtractPanel({
  corpusId,
  selected,
  onDone,
}: {
  corpusId: string;
  /** Document ids to run over. Empty = the whole corpus. */
  selected: string[];
  onDone: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [fields, setFields] = useState<Field[]>([{ name: "", instruction: "" }]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Start from what this corpus already extracts against, so a second batch
  // inherits the first batch's vocabulary instead of inventing its own.
  useEffect(() => {
    let live = true;
    fetchExtractionSpec(corpusId)
      .then(({ spec }: { spec: ExtractionSpec }) => {
        if (!live || !spec?.fields?.length) return;
        setInstruction(spec.instruction || "");
        setFields(spec.fields.map((f) => ({ name: f.name, instruction: f.instruction || "" })));
      })
      .catch(() => {/* no saved spec is the normal first-run case */});
    return () => { live = false; };
  }, [corpusId]);

  const usable = fields.filter((f) => f.name.trim());

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError("");
    setResult("");
    if (dryRun) setPreview(null);
    try {
      const out = await extractCorpus(corpusId, {
        instruction,
        fields: usable.map((f) => ({ name: f.name.trim(), instruction: f.instruction })),
        doc_ids: selected,
        dry_run: dryRun,
      });
      if (dryRun) {
        setPreview((out.preview?.[0]?.extracted as Record<string, unknown>) ?? {});
        setResult(`Would read ${out.would_process} document(s).`);
      } else {
        setResult(
          `${out.documents_with_new_suggestions} document(s) have new suggestions` +
            (out.failed ? `, ${out.failed} failed` : "") +
            ". Accept them in the labelling worksheet to make them values.",
        );
        setPreview(null);
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles size={14} /> Extract themes
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            {selected.length
              ? `${selected.length} selected`
              : "every document with evidence"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Your guidelines
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            placeholder="e.g. These are physiotherapy videos for knee arthritis. Use the coach's own words for exercise names. Note any movement a patient with a replaced knee should avoid."
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Sent with every document in the batch, so they come back described
            the same way.
          </p>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Fields to extract
          </label>
          <div className="mt-1 space-y-1.5">
            {fields.map((f, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={f.name}
                  onChange={(e) =>
                    setFields((fs) => fs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="field name"
                  className="w-32 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
                />
                <input
                  value={f.instruction}
                  onChange={(e) =>
                    setFields((fs) => fs.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x)))
                  }
                  placeholder="what counts as a correct value"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                  className="px-1 text-muted-foreground hover:text-foreground"
                  aria-label="remove field"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setFields((fs) => [...fs, { name: "", instruction: "" }])}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Plus size={11} /> add a field
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy || !usable.length}
                  onClick={() => void run(true)}>
            {busy ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
            Try on one
          </Button>
          <Button size="sm" disabled={busy || !usable.length || !preview}
                  onClick={() => void run(false)}>
            Run on {selected.length || "all"}
          </Button>
          {!preview && usable.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Try it on one first — you are about to spend a call per document.
            </span>
          )}
        </div>

        {preview && (
          <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
            <p className="mb-1 text-[11px] text-muted-foreground">
              What it returned for the first document:
            </p>
            <pre className="overflow-x-auto text-[11px] leading-relaxed">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        )}
        {result && <p className="text-[11px] text-muted-foreground">{result}</p>}
        {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
      </CardContent>
    </Card>
  );
}

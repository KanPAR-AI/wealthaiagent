import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchAgentConfig,
  updateAgentConfig,
  type RagConfig,
} from "@/services/agent-builder-service";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

// The same three choices the creation wizard shows (corpus-step.tsx), so an
// agent's grounding can be changed after it exists, not only at birth.
const GROUNDING = [
  { id: "corpus_only", label: "Only from its corpora", blurb: "Says plainly when they do not cover a question." },
  { id: "corpus_first", label: "Prefer corpora, allow general knowledge", blurb: "May go beyond them, labelling what it added." },
  { id: "blended", label: "Blend freely", blurb: "Corpus and model knowledge mixed, unlabelled." },
];

// "" and "on" are the same thing on the backend (unset = today's behaviour);
// the UI shows one switch.
const CITATIONS = [
  { id: "on", label: "Show sources", blurb: "Links to the moment in the talk inside the answer, and a Sources list at the end." },
  { id: "off", label: "Hide sources", blurb: "The answer still comes only from the corpus, but names no talk, link or timestamp." },
];

function Choice({
  options, value, onChange, testPrefix,
}: {
  options: { id: string; label: string; blurb: string }[];
  value: string;
  onChange: (id: string) => void;
  testPrefix: string;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          data-testid={`${testPrefix}-${o.id}`}
          aria-pressed={value === o.id}
          className={`flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
            value === o.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 hover:border-border"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm">
            {value === o.id && <Check size={12} className="text-emerald-400" />}
            {o.label}
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">{o.blurb}</span>
        </button>
      ))}
    </div>
  );
}

/** How this agent answers from its corpora: grounding and whether it cites. */
export function AnswerSettings({ agentId }: Props) {
  const [rag, setRag] = useState<RagConfig>({});
  const [grounding, setGrounding] = useState("corpus_only");
  const [citations, setCitations] = useState("on");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchAgentConfig(agentId);
      const r = config.rag ?? {};
      setRag(r);
      setGrounding(r.grounding || "corpus_only");
      setCitations((r.citations || "on").toLowerCase() === "off" ? "off" : "on");
      setDirty(false);
    } catch (err) {
      toast.error("Failed to load answer settings", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      // The whole rag block goes back: the PUT replaces it, and a partial
      // body would silently drop top_k / temperature / model.
      await updateAgentConfig(agentId, { rag: { ...rag, grounding, citations } });
      setRag({ ...rag, grounding, citations });
      setDirty(false);
      toast.success("Answer settings saved");
    } catch (err) {
      toast.error("Failed to save answer settings", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="answer-settings">
      <CardHeader>
        <CardTitle className="text-base">Answers</CardTitle>
        <CardDescription>
          What this agent may say beyond its corpora, and whether it shows where an answer came from.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">When the corpora do not have the answer</p>
              <Choice options={GROUNDING} value={grounding} testPrefix="grounding"
                onChange={(id) => { setGrounding(id); setDirty(true); }} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Source citations</p>
              <Choice options={CITATIONS} value={citations} testPrefix="citations"
                onChange={(id) => { setCitations(id); setDirty(true); }} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={save} disabled={!dirty || saving} data-testid="answer-settings-save">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span className="ml-1.5">Save</span>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

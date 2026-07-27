// Judge gold set — human labels that calibrate the LLM judge. docs/18 §1.3.
//
// The judge decides whether a Verified Procedure run passed. Nothing measured
// whether the JUDGE is any good, and that failure is silent: dashboards stay
// green while the grader quietly over-rewards fluent-but-wrong answers. This
// page collects human labels and scores the judge against them with Cohen's κ.
//
// Two deliberate design choices:
//   1. The AI reviewer ADVISES, it does not gate. Human labels are the scarce
//      resource; an over-strict gate just stops people contributing.
//   2. We report κ, not accuracy. On a 90%-pass set a judge that always says
//      "pass" scores 90% accuracy and is worthless — κ sees through that.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Curation, GoldItem, KappaResult, Verdict,
  addGoldItem, curateGoldItem, deleteGoldItem, listGoldItems, runKappa,
} from "@/services/gold-set-service";

const VERDICTS: Verdict[] = ["pass", "fail", "unknown"];

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: "bg-emerald-500/15 text-emerald-600",
  fail: "bg-red-500/15 text-red-600",
  unknown: "bg-amber-500/15 text-amber-600",
};

function RatingBadge({ c }: { c?: Curation }) {
  if (!c) return null;
  const map: Record<string, string> = {
    good: "bg-emerald-500/15 text-emerald-600",
    needs_work: "bg-amber-500/15 text-amber-600",
    reject: "bg-red-500/15 text-red-600",
    unchecked: "bg-zinc-500/15 text-zinc-500",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${map[c.rating] || map.unchecked}`}>
      {c.rating.replace("_", " ")}
    </span>
  );
}

export function GoldSetView() {
  const [items, setItems] = useState<GoldItem[]>([]);
  const [byVerdict, setByVerdict] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [rubric, setRubric] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("pass");
  const [curation, setCuration] = useState<Curation | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  // κ
  const [kappa, setKappa] = useState<KappaResult | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listGoldItems()
      .then((d) => { setItems(d.items); setByVerdict(d.by_verdict || {}); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const canSubmit = question.trim().length > 5 && answer.trim().length > 1;

  const check = async () => {
    setChecking(true); setError(null);
    try {
      setCuration(await curateGoldItem({
        question, candidate_answer: answer, human_verdict: verdict, rubric,
      }));
    } catch (e: any) { setError(e.message); } finally { setChecking(false); }
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await addGoldItem({
        question, candidate_answer: answer, human_verdict: verdict, rubric,
        curation,
      });
      setQuestion(""); setAnswer(""); setRubric(""); setVerdict("pass"); setCuration(null);
      load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const measure = async () => {
    setRunning(true); setError(null);
    try { setKappa(await runKappa()); }
    catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Judge Gold Set</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Human-labelled examples that calibrate the automated judge. Add cases
            where you know the right verdict, then measure how often the judge
            agrees with you.{" "}
            <span className="text-foreground font-medium">{items.length}</span> labelled
            {Object.entries(byVerdict).length > 0 && (
              <> · {Object.entries(byVerdict).map(([k, v]) => `${v} ${k}`).join(" · ")}</>
            )}
          </p>
        </div>
        <Button onClick={measure} disabled={running || items.length < 2}>
          {running ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
          Measure judge agreement
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {/* ── κ result ─────────────────────────────────────────────── */}
      {kappa && (
        <div className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-bold">
              κ = {kappa.kappa === null ? "—" : kappa.kappa.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">{kappa.interpretation}</span>
            {kappa.agreement !== null && (
              <span className="text-xs text-muted-foreground">
                (raw agreement {(kappa.agreement * 100).toFixed(0)}% over {kappa.n} items)
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Read κ against your own human-to-human ceiling, not against 1.0 — if two
            of your experts only agree κ≈0.7, a judge at 0.65 is near the practical
            limit. Raw agreement is shown because it is familiar, but it is
            misleading on its own: on a mostly-“pass” set a judge that always says
            “pass” scores high agreement and is worthless.
            {kappa.judge_model && <> Judge: <span className="font-mono">{kappa.judge_model}</span>.</>}
          </p>
          {kappa.disagreements.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-1">
                Where it disagreed with you ({kappa.disagreements.length}) — read these first
              </p>
              <div className="space-y-1">
                {kappa.disagreements.map((d) => (
                  <div key={d.id} className="text-xs flex items-center gap-2">
                    <span className={`px-1.5 rounded text-[10px] ${VERDICT_STYLE[d.human as Verdict]}`}>you: {d.human}</span>
                    <span className={`px-1.5 rounded text-[10px] ${VERDICT_STYLE[d.judge as Verdict]}`}>judge: {d.judge}</span>
                    <span className="truncate text-muted-foreground">{d.question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── add form ─────────────────────────────────────────────── */}
      <div className="border border-border rounded-lg p-4 mb-4">
        <h3 className="font-semibold mb-2 text-sm">Add a labelled example</h3>
        <div className="space-y-2">
          <textarea
            value={question} onChange={(e) => { setQuestion(e.target.value); setCuration(null); }}
            placeholder="What was asked of the system?"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm min-h-[60px]"
          />
          <textarea
            value={answer} onChange={(e) => { setAnswer(e.target.value); setCuration(null); }}
            placeholder="The answer being judged"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm min-h-[80px]"
          />
          <input
            value={rubric} onChange={(e) => { setRubric(e.target.value); setCuration(null); }}
            placeholder='What "correct" means here (optional but makes the label much sharper)'
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Your verdict</span>
            {VERDICTS.map((v) => (
              <button
                key={v} onClick={() => { setVerdict(v); setCuration(null); }}
                className={`px-2 py-1 rounded text-xs font-medium border ${
                  verdict === v ? VERDICT_STYLE[v] + " border-transparent"
                                : "border-border text-muted-foreground"}`}
              >
                {v}
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" size="sm" disabled={!canSubmit || checking} onClick={check}>
              {checking ? <Loader2 size={14} className="mr-1 animate-spin" />
                        : <Sparkles size={14} className="mr-1 text-violet-500" />}
              Check with AI
            </Button>
            <Button size="sm" disabled={!canSubmit || saving} onClick={save}>
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              Add to gold set
            </Button>
          </div>
        </div>

        {/* AI review — advisory, never blocks the save */}
        {curation && (
          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={13} className="text-violet-500" />
              <span className="text-xs font-semibold">AI review</span>
              <RatingBadge c={curation} />
              {curation.would_two_experts_agree
                ? <span className="text-[11px] text-emerald-600 flex items-center gap-1"><Check size={11} /> two experts would agree</span>
                : <span className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> experts might disagree — ambiguous</span>}
            </div>
            {curation.duplicate_of && (
              <p className="text-[11px] text-amber-600">
                Looks like a duplicate of <span className="font-mono">{curation.duplicate_of}</span>.
              </p>
            )}
            {curation.issues.length > 0 && (
              <ul className="text-[11px] text-muted-foreground list-disc ml-4 mt-1">
                {curation.issues.map((i, n) => <li key={n}>{i}</li>)}
              </ul>
            )}
            {curation.suggestions.length > 0 && (
              <>
                <p className="text-[11px] font-medium mt-1.5">Suggested fixes</p>
                <ul className="text-[11px] text-muted-foreground list-disc ml-4">
                  {curation.suggestions.map((s, n) => <li key={n}>{s}</li>)}
                </ul>
              </>
            )}
            {curation.rating === "unchecked" && (
              <p className="text-[11px] text-muted-foreground">
                Review unavailable{curation.error ? ` (${curation.error})` : ""} — you can still add
                the example. A curation outage shouldn't stop you labelling.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── the set ──────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No labelled examples yet. Aim for 100–300 across the verdicts you care
          about — and include cases where the answer should FAIL, not just pass.
          A one-sided set produces a one-sided judge.
        </p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="p-3 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${VERDICT_STYLE[it.human_verdict]}`}>
                  {it.human_verdict}
                </span>
                <RatingBadge c={it.curation} />
                <span className="text-muted-foreground truncate flex-1">{it.question}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{it.added_by}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive shrink-0"
                        onClick={() => deleteGoldItem(it.id).then(load).catch((e) => setError(e.message))}
                        title="Remove">
                  <Trash2 size={11} />
                </Button>
              </div>
              <p className="text-muted-foreground line-clamp-2">{it.candidate_answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

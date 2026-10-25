// The corpus as a graph — chapter → verse → talk → passage, each node with
// its note, every gap listed. Built for debugging a series (owner,
// 2026-10-23): "visualize the whole 18 chapters and the summary on top of
// that and linkages". Plain SVG, no graph library: the layout is a known
// ladder (verses down the left, talks down the right, an edge per
// verse-in-talk), and a force layout would turn a ladder into a hairball.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchCorpusGraph,
  type CorpusGraph,
  type EntityKind,
  type GraphChapter,
  type GraphEntity,
  type GraphTalk,
  type GraphUnit,
  type GraphVerse,
} from "@/services/corpus-video-service";

interface Props {
  corpusId: string;
  onBack: () => void;
  onOpenAsset?: (source: string) => void;
}

type Selected =
  | { kind: "chapter"; chapter: number }
  | { kind: "verse"; chapter: number; verse: number }
  | { kind: "talk"; source: string; unit?: number }
  | { kind: "entity"; ekind: EntityKind; id: string }
  | null;

const ENTITY_KINDS: EntityKind[] = ["story", "reference", "concept"];
const UNIT_COLOR: Record<string, string> = {
  recitation: "bg-amber-400", explanation: "bg-sky-400", story: "bg-emerald-400",
  reference: "bg-violet-400", aside: "bg-zinc-500",
};

function watchAt(url: string, s: number): string | undefined {
  if (!url) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}t=${Math.floor(s)}`;
}

const ROW = 16;        // px per verse row
const TALK_H = 40;     // px per talk card
const W = 880;
const VX = 70;         // verse column x
const TX = 420;        // talk column x
const TW = 430;

function mmss(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "";
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function verseFill(v: GraphVerse): string {
  if (v.talks.length === 0) return "fill-red-500/70";
  if (!v.note) return "fill-amber-400/80";
  return v.talks.length > 1 ? "fill-sky-400" : "fill-emerald-400";
}

function talkStroke(t: GraphTalk): string {
  if (t.placed_by === "transcript") return "stroke-violet-400";
  if (t.placed_by === "title") return "stroke-sky-400";
  return "stroke-red-400";
}

export function CorpusGraphView({ corpusId, onBack, onOpenAsset }: Props) {
  const [expected, setExpected] = useState(18);
  const [data, setData] = useState<CorpusGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapter, setChapter] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [query, setQuery] = useState("");
  const [gapOpen, setGapOpen] = useState<string | null>(null);
  const [ekind, setEkind] = useState<EntityKind>("story");
  const [efilter, setEfilter] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const g = await fetchCorpusGraph(corpusId, expected);
      setData(g);
      if (chapter == null) {
        const first = g.chapters.find((c) => c.present);
        if (first) setChapter(first.chapter);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [corpusId, expected]);

  const current: GraphChapter | undefined = useMemo(
    () => data?.chapters.find((c) => c.chapter === chapter), [data, chapter]);

  const jump = () => {
    const m = query.trim().match(/^(\d+)(?:[.:](\d+))?$/);
    if (!m || !data) return;
    const ch = Number(m[1]);
    setChapter(ch);
    setSelected(m[2] ? { kind: "verse", chapter: ch, verse: Number(m[2]) } : { kind: "chapter", chapter: ch });
  };

  if (loading && !data) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Building the graph…</div>;
  }
  if (error && !data) {
    return <div className="p-6 text-sm text-red-400" role="alert">Could not load the graph: {error}</div>;
  }
  if (!data) return null;

  const talkRows = current ? current.talks.map((k) => data.talks[k]).filter(Boolean) : [];
  const height = Math.max(current ? current.verse_max * ROW + 40 : 200, talkRows.length * (TALK_H + 8) + 40, 200);
  const verseY = (v: number) => 24 + (v - 1) * ROW;
  const talkY = (i: number) => 20 + i * (TALK_H + 8);

  return (
    <div className="space-y-4" data-testid="corpus-graph">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={14} /><span className="ml-1">Back</span></Button>
        <h2 className="text-base font-semibold">Graph · {data.corpus_id}</h2>
        <span className="text-xs text-muted-foreground">
          {data.counts.chapters} chapters · {data.counts.verses} verses · {data.counts.talks} talks · {data.counts.passages} passages · {Math.round(data.counts.minutes / 60)} h
          {" · notes "}{data.counts.talk_notes}/{data.counts.talks} talk, {data.counts.verse_notes} verse, {data.counts.chapter_notes} chapter
          {data.counts.units ? <span data-testid="unit-counts">{" · "}{data.counts.units} units in {data.counts.talks_with_units}/{data.counts.talks} talks · {data.counts.stories ?? 0} stories · {data.counts.references ?? 0} references · {data.counts.concepts ?? 0} concepts ({data.counts.concept_notes ?? 0} notes)</span> : null}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground">chapters expected
            <input type="number" min={0} value={expected} onChange={(e) => setExpected(Number(e.target.value) || 0)}
              className="ml-1 w-14 rounded border border-border/60 bg-transparent px-1 py-0.5 text-xs" data-testid="expected-chapters" />
          </label>
          <div className="flex items-center gap-1">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && jump()}
              placeholder="2.47" className="w-20 rounded border border-border/60 bg-transparent px-2 py-0.5 text-xs" data-testid="jump-input" />
            <Button variant="ghost" size="sm" onClick={jump} data-testid="jump"><Search size={14} /></Button>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></Button>
        </div>
      </div>

      {/* Every chapter on one strip — the "whole 18" at a glance. */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 lg:grid-cols-18" data-testid="chapter-strip">
        {data.chapters.map((c) => {
          const cov = c.coverage; const pct = cov && c.verse_max ? Math.round((100 * cov.verses_with_talk) / c.verse_max) : 0;
          return (
            <button key={c.chapter} type="button" onClick={() => { setChapter(c.chapter); setSelected({ kind: "chapter", chapter: c.chapter }); }}
              data-testid={`chapter-${c.chapter}`} aria-pressed={chapter === c.chapter}
              title={c.present ? `${cov?.talks} talks · ${cov?.verses_with_talk}/${c.verse_max} verses placed · ${cov?.verses_with_note} verse notes` : "missing"}
              className={`rounded-md border px-1 py-1 text-left text-[11px] ${chapter === c.chapter ? "border-emerald-500/60 bg-emerald-500/10" : c.present ? "border-border/60" : "border-dashed border-red-500/60 text-red-400"}`}>
              <div className="flex items-center justify-between"><span className="font-medium">{c.chapter}</span>{c.note && <span className="text-emerald-400">●</span>}</div>
              {c.present ? (
                <div className="mt-1 h-1 w-full rounded bg-border/60"><div className="h-1 rounded bg-emerald-400" style={{ width: `${pct}%` }} /></div>
              ) : <div className="mt-1 text-[10px]">none</div>}
            </button>
          );
        })}
      </div>

      {/* Gaps, named. */}
      <div className="flex flex-wrap gap-1.5" data-testid="gaps">
        {Object.entries(data.gaps).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setGapOpen(gapOpen === k ? null : k)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${v.length ? "border-amber-500/50 text-amber-300" : "border-border/60 text-muted-foreground"}`}>
            {k.replace(/_/g, " ")} · {v.length}
          </button>
        ))}
      </div>
      {gapOpen && data.gaps[gapOpen]?.length > 0 && (
        <div className="flex max-h-28 flex-wrap gap-1 overflow-auto rounded-md border border-border/60 p-2 text-[11px]" data-testid="gap-list">
          {data.gaps[gapOpen].map((item) => (
            <button key={String(item)} type="button" className="rounded border border-border/60 px-1.5 py-0.5 hover:border-emerald-500/50"
              onClick={() => {
                const s = String(item); const m = s.match(/^(\d+)\.(\d+)$/);
                if (m) { setChapter(Number(m[1])); setSelected({ kind: "verse", chapter: Number(m[1]), verse: Number(m[2]) }); }
                else if (/^\d+$/.test(s)) { setChapter(Number(s)); setSelected({ kind: "chapter", chapter: Number(s) }); }
                else if (data.talks[s]) { setChapter(data.talks[s].chapter); setSelected({ kind: "talk", source: s }); }
              }}>{String(item)}</button>
          ))}
        </div>
      )}

      {/* The entity layer: stories, references, concepts, each with every telling. */}
      {data.entities && ENTITY_KINDS.some((k) => (data.entities?.[k] ?? []).length > 0) && (
        <div className="rounded-md border border-border/60 p-2" data-testid="entity-strip">
          <div className="flex flex-wrap items-center gap-1">
            {ENTITY_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setEkind(k)} aria-pressed={ekind === k} data-testid={`entity-tab-${k}`}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${ekind === k ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/60"}`}>
                {k === "story" ? "stories" : k === "reference" ? "references" : "concepts"} · {(data.entities?.[k] ?? []).length}
              </button>
            ))}
            <input value={efilter} onChange={(e) => setEfilter(e.target.value)} placeholder="filter…"
              className="ml-auto w-32 rounded border border-border/60 bg-transparent px-2 py-0.5 text-xs" data-testid="entity-filter" />
          </div>
          <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-auto" data-testid="entity-list">
            {(data.entities?.[ekind] ?? [])
              .filter((e) => !efilter || `${e.name} ${e.aliases.join(" ")}`.toLowerCase().includes(efilter.toLowerCase()))
              .slice(0, 150)
              .map((e) => {
                const on = selected?.kind === "entity" && selected.id === e.id;
                return (
                  <button key={e.id} type="button" onClick={() => setSelected({ kind: "entity", ekind, id: e.id })} data-testid={`entity-${e.id}`}
                    title={`${e.talk_count} talks · ${e.count} mentions · chapters ${e.chapters.join(", ")}`}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${on ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/60 hover:border-emerald-500/50"}`}>
                    {e.name.slice(0, 40)} <span className="text-muted-foreground">{e.talk_count}t/{e.count}</span>{e.note && <span className="ml-1 text-emerald-400">●</span>}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* The ladder: verses left, talks right, an edge per verse-in-talk. */}
        <div className="min-w-0 flex-1 overflow-auto rounded-md border border-border/60">
          {current && current.present ? (
            <svg width={W} height={height} className="text-xs" data-testid="ladder">
              <text x={VX - 50} y={12} className="fill-muted-foreground">verses</text>
              <text x={TX} y={12} className="fill-muted-foreground">talks (blue: placed by title · violet: placed from transcript · red: unplaced · dashed: no note)</text>
              {talkRows.map((t, i) => t.verses.map((v) => (
                <path key={`${t.source}-${v}`} d={`M ${VX + 6} ${verseY(v)} C ${VX + 120} ${verseY(v)}, ${TX - 120} ${talkY(i) + TALK_H / 2}, ${TX} ${talkY(i) + TALK_H / 2}`}
                  className={`fill-none ${t.placed_by === "transcript" ? "stroke-violet-400/40" : "stroke-sky-400/40"}`} strokeWidth={1} />
              )))}
              {current.verses.map((v) => {
                const on = selected?.kind === "verse" && selected.verse === v.verse;
                return (
                  <g key={v.ref} onClick={() => setSelected({ kind: "verse", chapter: current.chapter, verse: v.verse })} className="cursor-pointer" data-testid={`verse-${v.ref}`}>
                    <circle cx={VX} cy={verseY(v.verse)} r={on ? 7 : 5} className={`${verseFill(v)} ${on ? "stroke-white" : "stroke-transparent"}`} strokeWidth={2} />
                    <text x={VX - 12} y={verseY(v.verse) + 4} textAnchor="end" className="fill-foreground">{v.verse}</text>
                  </g>
                );
              })}
              {talkRows.map((t, i) => {
                const on = selected?.kind === "talk" && selected.source === t.source;
                return (
                  <g key={t.source} onClick={() => setSelected({ kind: "talk", source: t.source })} className="cursor-pointer" data-testid={`talk-${t.source}`}>
                    <rect x={TX} y={talkY(i)} width={TW} height={TALK_H} rx={6}
                      className={`${on ? "fill-emerald-500/20" : "fill-background"} ${talkStroke(t)}`} strokeWidth={on ? 2 : 1.2} strokeDasharray={t.note ? undefined : "4 3"} />
                    <text x={TX + 8} y={talkY(i) + 16} className="fill-foreground font-medium">
                      {t.talk != null ? `Talk ${t.talk}` : "Talk ?"} · {t.verses.length ? `v${t.verses[0]}${t.verses.length > 1 ? `–${t.verses[t.verses.length - 1]}` : ""}` : "no verses"} · {Math.round(t.duration_s / 60)} min · {t.units?.length ? `${t.units.length} units` : `${t.passages} passages`}{t.language && t.language !== "hi" ? ` · ${t.language}` : ""}
                    </text>
                    <text x={TX + 8} y={talkY(i) + 31} className="fill-muted-foreground">{t.title.slice(0, 70)}</text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">{chapter != null ? `Chapter ${chapter} has nothing ingested.` : "Pick a chapter."}</div>
          )}
        </div>

        {/* The note on top of the node. */}
        <aside className="w-full shrink-0 rounded-md border border-border/60 p-3 text-sm lg:w-[380px]" data-testid="node-panel">
          <NodePanel data={data} current={current} selected={selected} onOpenAsset={onOpenAsset} onSelect={setSelected} />
        </aside>
      </div>
    </div>
  );
}

function NodePanel({ data, current, selected, onOpenAsset, onSelect }: {
  data: CorpusGraph; current?: GraphChapter; selected: Selected;
  onOpenAsset?: (source: string) => void; onSelect: (s: Selected) => void;
}) {
  if (!selected) {
    return <p className="text-muted-foreground">Click a chapter, a verse or a talk to read its note here.</p>;
  }
  if (selected.kind === "chapter") {
    const c = data.chapters.find((x) => x.chapter === selected.chapter);
    if (!c || !c.present) return <p className="text-red-400">Chapter {selected.chapter} is not in the corpus.</p>;
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{c.title}</h3>
        <p className="text-xs text-muted-foreground">{c.coverage?.talks} talks · {c.coverage?.minutes} min · {c.coverage?.verses_with_talk}/{c.verse_max} verses placed · {c.coverage?.verses_with_note} verse notes · {c.coverage?.talks_with_note} talk notes</p>
        <Note note={c.note} empty="No chapter overview yet." />
      </div>
    );
  }
  if (selected.kind === "verse") {
    const v = current?.verses.find((x) => x.verse === selected.verse);
    if (!v) return <p className="text-red-400">Verse {selected.chapter}.{selected.verse} is not in the graph.</p>;
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">Verse {v.ref}</h3>
        <div className="flex flex-wrap gap-1">
          {v.talks.length === 0 && <span className="text-xs text-red-400">no talk takes this verse up</span>}
          {v.talks.map((s) => {
            const t = data.talks[s]; const span = t?.spans.find((p) => p.verse === v.verse);
            return (
              <button key={s} type="button" onClick={() => onSelect({ kind: "talk", source: s })}
                className="rounded border border-border/60 px-1.5 py-0.5 text-xs hover:border-emerald-500/50">
                {t?.talk != null ? `Talk ${t.talk}` : s}{span ? ` @ ${mmss(span.start_s)}` : ""}
              </button>
            );
          })}
        </div>
        <Note note={v.note} empty="No verse note yet." />
      </div>
    );
  }
  if (selected.kind === "entity") {
    const e: GraphEntity | undefined = (data.entities?.[selected.ekind] ?? []).find((x) => x.id === selected.id);
    if (!e) return <p className="text-red-400">Unknown {selected.ekind}.</p>;
    return (
      <div className="space-y-2" data-testid="entity-panel">
        <h3 className="font-semibold">{selected.ekind === "story" ? "Story" : selected.ekind === "reference" ? "Reference" : "Concept"}: {e.name}</h3>
        {e.aliases.length > 0 && <p className="text-xs text-muted-foreground">also: {e.aliases.join(" · ")}</p>}
        <p className="text-xs text-muted-foreground">{e.count} mentions in {e.talk_count} talks · chapters {e.chapters.join(", ") || "?"}{e.verses.length ? ` · verses ${e.verses.slice(0, 12).join(", ")}${e.verses.length > 12 ? "…" : ""}` : ""}</p>
        <ul className="max-h-48 space-y-1 overflow-auto text-xs" data-testid="mentions">
          {e.mentions.map((m, i) => {
            const t = data.talks[m.source];
            return (
              <li key={`${m.source}-${i}`} className="flex flex-wrap items-center gap-1">
                <button type="button" className="rounded border border-border/60 px-1 py-0.5 hover:border-emerald-500/50"
                  onClick={() => onSelect({ kind: "talk", source: m.source, unit: t?.units?.find((u) => u.unit_id === m.unit_id)?.index })}>
                  {t?.talk != null ? `Ch ${m.chapter ?? t.chapter} · Talk ${t.talk}` : m.source.slice(0, 30)}
                </button>
                <a href={t?.url ? watchAt(t.url, m.start_s) : undefined} target="_blank" rel="noreferrer" className="text-sky-400">@ {mmss(m.start_s)}</a>
                {m.verses.length > 0 && <span className="text-muted-foreground">v{m.verses.join(",")}</span>}
                <span className="text-muted-foreground">{m.unit_title}</span>
              </li>
            );
          })}
        </ul>
        <Note note={e.note} empty={selected.ekind === "concept" ? "No concept note (below the threshold, or not yet written)." : "A card is built from the mentions above at publish."} />
      </div>
    );
  }
  const t = data.talks[selected.source];
  if (!t) return <p className="text-red-400">Unknown talk.</p>;
  const units: GraphUnit[] = t.units ?? [];
  const unit = selected.unit != null ? units.find((u) => u.index === selected.unit) : undefined;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{t.title}</h3>
      <p className="text-xs text-muted-foreground">
        chapter {t.chapter ?? "?"} · talk {t.talk ?? "?"} · {Math.round(t.duration_s / 60)} min · {t.passages} passages · placed by {t.placed_by.replace("_", " ")} · {t.language || "?"}
      </p>
      <div className="flex flex-wrap gap-1">
        {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400"><ExternalLink size={12} /> watch</a>}
        {onOpenAsset && <button type="button" onClick={() => onOpenAsset(t.source)} className="text-xs text-sky-400">open asset</button>}
      </div>
      {(t.continues_from || t.continues_in) && (
        <p className="text-xs text-muted-foreground" data-testid="continuation">
          {t.continues_from && data.talks[t.continues_from] && (
            <button type="button" className="text-sky-400" data-testid="continues-from"
              onClick={() => onSelect({ kind: "talk", source: t.continues_from! })}>← continues talk {data.talks[t.continues_from].talk ?? "?"}</button>
          )}
          {t.continues_from && t.continues_in && " · "}
          {t.continues_in && data.talks[t.continues_in] && (
            <button type="button" className="text-sky-400" data-testid="continues-in"
              onClick={() => onSelect({ kind: "talk", source: t.continues_in! })}>continues in talk {data.talks[t.continues_in].talk ?? "?"} →</button>
          )}
        </p>
      )}
      {t.spans.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.spans.map((p) => (
            <a key={p.verse} href={t.url ? `${t.url}${t.url.includes("?") ? "&" : "?"}t=${Math.floor(p.start_s)}` : undefined} target="_blank" rel="noreferrer"
              className="rounded border border-border/60 px-1.5 py-0.5 text-xs">v{p.verse} @ {mmss(p.start_s)}</a>
          ))}
        </div>
      )}
      {units.length > 0 ? (
        <div data-testid="units">
          <p className="text-[11px] text-muted-foreground">{units.length} units · {Object.entries(t.unit_kinds ?? {}).map(([k, n]) => `${n} ${k}`).join(" · ")}{t.units_model ? ` · ${t.units_model}` : ""}</p>
          {/* The talk as a timeline of units, each as wide as it is long. */}
          <div className="mt-1 flex h-3 w-full overflow-hidden rounded" title="units by time">
            {units.map((u) => (
              <button key={u.index} type="button" onClick={() => onSelect({ kind: "talk", source: t.source, unit: u.index })}
                title={`[${mmss(u.start_s)}] ${u.kind}: ${u.title}`} data-testid={`unit-bar-${u.index}`}
                className={`${UNIT_COLOR[u.kind] ?? "bg-zinc-400"} ${unit?.index === u.index ? "opacity-100 ring-1 ring-white" : "opacity-70 hover:opacity-100"}`}
                style={{ width: `${Math.max(0.5, (100 * (u.end_s - u.start_s)) / Math.max(1, t.duration_s))}%` }} />
            ))}
          </div>
          <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-xs">
            {units.map((u) => (
              <li key={u.index}>
                <button type="button" onClick={() => onSelect({ kind: "talk", source: t.source, unit: u.index })} data-testid={`unit-${u.index}`}
                  className={`w-full rounded px-1 py-0.5 text-left hover:bg-emerald-500/10 ${unit?.index === u.index ? "bg-emerald-500/10" : ""}`}>
                  <span className="text-muted-foreground">[{mmss(u.start_s)}]</span> <span className={`inline-block h-2 w-2 rounded-sm ${UNIT_COLOR[u.kind] ?? "bg-zinc-400"}`} /> {u.title}{u.verses.length ? <span className="text-muted-foreground"> · v{u.verses.join(",")}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {unit && (
            <div className="mt-2 rounded border border-border/60 p-2 text-xs" data-testid="unit-detail">
              <p className="font-medium">{unit.kind} · {mmss(unit.start_s)}–{mmss(unit.end_s)} · {unit.chars ?? "?"} chars{unit.verses.length ? ` · verse ${unit.verses.join(", ")}` : ""}
                {t.url && <a href={watchAt(t.url, unit.start_s)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-sky-400"><ExternalLink size={11} /> open here</a>}
              </p>
              <p className="mt-1">{unit.gist}</p>
              {unit.facets && (
                <p className="mt-1 text-muted-foreground">
                  {unit.facets.story ? `story: ${unit.facets.story} · ` : ""}
                  {unit.facets.concepts?.length ? `concepts: ${unit.facets.concepts.join(", ")} · ` : ""}
                  {unit.facets.references?.length ? `references: ${unit.facets.references.join(", ")} · ` : ""}
                  {unit.facets.people?.length ? `people: ${unit.facets.people.join(", ")}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-300" data-testid="units-empty">No discourse units yet — this talk is indexed as fixed windows.</p>
      )}
      <Note note={t.note} empty="No talk note yet." />
    </div>
  );
}

function Note({ note, empty }: { note: { text: string; chars: number; model?: string; updated_at?: string } | null; empty: string }) {
  if (!note) return <p className="text-xs text-amber-300" data-testid="note-empty">{empty}</p>;
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{note.chars} chars{note.model ? ` · ${note.model}` : ""}{note.updated_at ? ` · ${note.updated_at.slice(0, 16).replace("T", " ")}` : ""}</p>
      <pre className="mt-1 max-h-[60vh] overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed" data-testid="note-text">{note.text}</pre>
    </div>
  );
}

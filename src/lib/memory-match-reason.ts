// lib/memory-match-reason.ts — UI_SPEC §4: "Results must show the match
// reason: Semantic / Exact value / Entity / Predicate." Pure relabeling of
// the engine's own `channels`/`retrieval_reason` (services/memory/
// retrieval/pipeline.py, ranker.py) into the four spec categories — never
// a recomputation of WHY something matched (STATE_MODEL).
export function memoryMatchReasonLabel(
  channels: string[],
  retrievalReason: string | null,
): string | null {
  if (channels.includes("exact")) return "Exact value";
  if (channels.includes("entity")) return "Entity";
  if (channels.includes("semantic")) return "Semantic";
  if (channels.includes("lexical")) return "Semantic";
  if (channels.includes("structured")) return "Predicate";
  if (channels.includes("pinned")) return "Pinned";
  if (channels.includes("cache")) return "Cached result";
  if (retrievalReason && /predicate|structured/i.test(retrievalReason)) {
    return "Predicate";
  }
  return null;
}

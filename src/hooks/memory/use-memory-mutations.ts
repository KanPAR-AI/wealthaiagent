// hooks/memory/use-memory-mutations.ts — Add / Correct / Forget / Broad-forget
// (UI-2, UI_SPEC §20-24, §47-48). The non-negotiable rules (memory-spec,
// security-boundaries) live here:
//   • NO optimistic success for any lifecycle mutation — state reflects only
//     the backend's authoritative response.
//   • Forget completeness is NOT computed by the client: a forget is
//     "complete" ONLY when the engine's ForgetResult.projection_purges.pending
//     is empty. A non-empty pending is an honest "cleanup incomplete" state,
//     never success.
//   • Authority/confidence are never client-set (the policy engine decides).
import { useCallback, useState } from "react";
import {
  addMemory,
  correctMemory,
  forgetMemory,
  forgetByFilter,
  forgetDryRun,
  MemoryEngineError,
  type WriteBody,
  type CorrectBody,
  type ForgetBody,
  type ForgetResult,
  type WriteResult,
  type ForgetDryRunResult,
} from "@/services/memory-engine-service";

export type MutationPhase = "idle" | "pending" | "success" | "error";

/** Forget has THREE terminal outcomes, not two — "complete" and
 *  "cleanup incomplete" are different truths the UI must not conflate. */
export type ForgetOutcome = "complete" | "incomplete" | "not_found";

function classifyForget(r: ForgetResult): ForgetOutcome {
  if (r.not_found || r.forgotten_count === 0) return "not_found";
  // The engine's own accounting is authoritative — never fabricate "fully
  // forgotten" (MUI-0023). Pending purges = disabled from canonical
  // retrieval but derived-index cleanup still owed.
  return r.projection_purges.pending.length === 0 ? "complete" : "incomplete";
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof MemoryEngineError ? err.message : fallback;
}

// ── Add ──────────────────────────────────────────────────────────────────
export function useAddMemory() {
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const [result, setResult] = useState<WriteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (body: WriteBody) => {
    setPhase("pending");
    setError(null);
    setResult(null);
    try {
      const { results } = await addMemory(body);
      // A policy rejection is NOT a success even though HTTP may be 200 for a
      // multi-fact write; surface the reason honestly.
      if (results.length && results.every((r) => r.operation === "rejected")) {
        setError(results[0].decision_reason || "The memory was not stored.");
        setPhase("error");
        return null;
      }
      setResult(results);
      setPhase("success");
      return results;
    } catch (err) {
      setError(messageOf(err, "The memory was not stored. No changes were saved."));
      setPhase("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
  }, []);
  return { phase, result, error, submit, reset };
}

// ── Correct ──────────────────────────────────────────────────────────────
export function useCorrectMemory() {
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const [result, setResult] = useState<WriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false); // 409 stale — refetch+retry

  const submit = useCallback(async (memoryId: string, body: CorrectBody) => {
    setPhase("pending");
    setError(null);
    setConflict(false);
    try {
      const r = await correctMemory(memoryId, body);
      setResult(r);
      setPhase("success");
      return r;
    } catch (err) {
      if (err instanceof MemoryEngineError && err.status === 409) {
        setConflict(true);
        setError("This memory changed since you opened it. Refetch and retry.");
        setPhase("error");
        return null;
      }
      setError(messageOf(err, "Memory was not updated. No changes were saved."));
      setPhase("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
    setConflict(false);
  }, []);
  return { phase, result, error, conflict, submit, reset };
}

// ── Forget (single + broad) ────────────────────────────────────────────────
export function useForgetMemory() {
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const [outcome, setOutcome] = useState<ForgetOutcome | null>(null);
  const [result, setResult] = useState<ForgetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forgetById = useCallback(async (memoryId: string) => {
    setPhase("pending");
    setError(null);
    setOutcome(null);
    try {
      const r = await forgetMemory(memoryId);
      setResult(r);
      setOutcome(classifyForget(r));
      setPhase("success"); // "success" = the request resolved; read `outcome`
      return r;
    } catch (err) {
      setError(messageOf(err, "The memory could not be forgotten."));
      setPhase("error");
      return null;
    }
  }, []);

  const forgetBroad = useCallback(async (filter: ForgetBody) => {
    setPhase("pending");
    setError(null);
    setOutcome(null);
    try {
      const r = await forgetByFilter(filter);
      setResult(r);
      setOutcome(classifyForget(r));
      setPhase("success");
      return r;
    } catch (err) {
      setError(messageOf(err, "The memories could not be forgotten."));
      setPhase("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setOutcome(null);
    setResult(null);
    setError(null);
  }, []);

  return { phase, outcome, result, error, forgetById, forgetBroad, reset };
}

/** Broad-forget count preview — the ENGINE's affected count (Q8 resolved),
 *  called BEFORE the user confirms. Mutates nothing. */
export function useForgetPreview() {
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const [preview, setPreview] = useState<ForgetDryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filter: ForgetBody) => {
    setPhase("pending");
    setError(null);
    try {
      const p = await forgetDryRun(filter);
      setPreview(p);
      setPhase("success");
      return p;
    } catch (err) {
      setError(messageOf(err, "Could not preview the affected memories."));
      setPhase("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setPreview(null);
    setError(null);
  }, []);
  return { phase, preview, error, load, reset };
}

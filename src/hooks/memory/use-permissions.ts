// hooks/memory/use-permissions.ts — cosmetic permission gate for the Memory
// OS UI (PERMISSIONS.md, security-boundaries skill).
//
// HARD RULE: this hook prevents MISTAKES, not attacks. Every one of the 9
// booleans it returns is a UI convenience only — the real gate is the
// backend `authorize()` (and the evidence/raw/debug gates inside the new
// BUILD wrappers) re-checked on every request. A missing/incorrect value
// here can hide a button; it can never open a hole, because nothing reads
// these booleans to decide what data to render — every screen still gets
// its data from the backend response (or a 403 that a hidden button meant
// the user never gets to trigger by mistake).
//
// PROPOSED endpoint `GET /api/v1/memory/permissions` (OPEN_QUESTIONS Q3)
// does not exist yet. Until it lands, this hook derives an interim,
// deliberately conservative signal from the existing auth session:
//   - memory.read / create / correct / forget: any signed-in user (the
//     Memory OS UI's primary users are advanced users/evaluators too, not
//     just admins — ADR-001). The backend's `authorize()` scopes every
//     request to the caller's own data regardless of this flag.
//   - memory.read_evidence: same as read for now (no separate backend
//     signal to read client-side yet; the evidence wrapper (UI-3,
//     MUI-1007) enforces its own gate server-side and can withhold
//     evidence while the memory stays visible — PERMISSIONS.md rule 2).
//   - memory.read_raw / memory.debug_retrieval / memory.admin: gated on
//     the existing admin/role signal (`isAdmin`) as the conservative
//     fallback named in ADR-001's "Residual risk" — this MAY over-hide
//     these affordances for a non-admin evaluator who should have them;
//     it will never under-hide (fail closed), and the backend 403s either
//     way. Resolved when Q3 lands.
//   - memory.read_cross_user: ALWAYS false. ADR-005 — cross-user reading
//     is out of v1; there is no enforcement point in `authorize()` that
//     would honor it, so no UI signal may ever claim otherwise. Do not
//     wire this to any future admin flag without a new ADR.

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";

/** The 9 permissions from UI_SPEC §49 / PERMISSIONS.md, verbatim. */
export interface MemoryPermissions {
  "memory.read": boolean;
  "memory.create": boolean;
  "memory.correct": boolean;
  "memory.forget": boolean;
  "memory.read_evidence": boolean;
  "memory.read_raw": boolean;
  "memory.debug_retrieval": boolean;
  /** ADR-005 — permanently false in v1; see file header. */
  "memory.read_cross_user": boolean;
  "memory.admin": boolean;
}

export interface UsePermissionsResult {
  permissions: MemoryPermissions;
  /** True while the underlying auth session is still resolving — callers
   *  should not render a hard "access denied" until this settles. */
  loading: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { isSignedIn, isAdmin, isAuthLoading } = useAuth();

  const permissions = useMemo<MemoryPermissions>(
    () => ({
      "memory.read": isSignedIn,
      "memory.create": isSignedIn,
      "memory.correct": isSignedIn,
      "memory.forget": isSignedIn,
      "memory.read_evidence": isSignedIn,
      "memory.read_raw": isSignedIn && isAdmin,
      "memory.debug_retrieval": isSignedIn && isAdmin,
      "memory.read_cross_user": false,
      "memory.admin": isSignedIn && isAdmin,
    }),
    [isSignedIn, isAdmin],
  );

  return { permissions, loading: isAuthLoading };
}

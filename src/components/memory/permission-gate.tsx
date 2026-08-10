// components/memory/permission-gate.tsx — cosmetic affordance gate.
//
// Hides/disables a UI affordance by one of the 9 memory.* permissions.
// COSMETIC ONLY (security-boundaries skill, PERMISSIONS.md rule 1): the
// backend re-checks every one of these on the actual request. Do not use
// this component to decide whether to RENDER DATA that came back from the
// backend — only to decide whether to offer an action (a button, a tab
// trigger, a nav item). Hiding a button prevents a mistake; it is not the
// security boundary.
import type { ReactNode } from "react";
import { usePermissions, type MemoryPermissions } from "@/hooks/memory/use-permissions";

export interface PermissionGateProps {
  perm: keyof MemoryPermissions;
  children: ReactNode;
  /** Rendered instead of children when the permission is absent. Omit to
   *  render nothing (the common case — e.g. hide the Debugger nav item). */
  fallback?: ReactNode;
}

export function PermissionGate({ perm, children, fallback = null }: PermissionGateProps) {
  const { permissions, loading } = usePermissions();
  // While the session is resolving, render nothing rather than flashing an
  // affordance the user may not keep (avoids a visible hide-on-load blink
  // for the common signed-in case, and never fake-grants for the anon case
  // because the default permission set above is all-false until signed in).
  if (loading) return null;
  if (!permissions[perm]) return <>{fallback}</>;
  return <>{children}</>;
}

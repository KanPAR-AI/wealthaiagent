// components/memory/memory-route-guard.tsx — entry gate for /memory/* (§2,
// ADR-001). Permission-aware, NOT the admin-only <ProtectedRoute
// requireAdmin> — the primary users of the Memory OS UI include advanced
// users/evaluators, not just admins.
//
// COSMETIC (security-boundaries skill): this only decides whether to mount
// the route's data-fetching components. It fires NO data request itself
// when it denies — "Missing → redirect to a 403 surface, no data request
// fires" (ROUTES.md). The real gate is every request's backend
// `authorize()`, which 403s regardless of what this guard decided.
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, type MemoryPermissions } from "@/hooks/memory/use-permissions";

export interface MemoryRouteGuardProps {
  perm: keyof MemoryPermissions;
  children: React.ReactNode;
}

export function MemoryRouteGuard({ perm, children }: MemoryRouteGuardProps) {
  const { isAuthLoading, isSignedIn } = useAuth();
  const { permissions, loading } = usePermissions();

  if (isAuthLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (!permissions[perm]) {
    return <MemoryAccessDenied />;
  }

  return <>{children}</>;
}

function MemoryAccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" role="alert">
      <h1 className="text-6xl font-bold text-destructive">403</h1>
      <h2 className="text-2xl font-semibold">Access Denied</h2>
      <p className="text-muted-foreground">You do not have permission to view Memory.</p>
      <Navigate to="/chat" replace />
    </div>
  );
}

// components/auth/protected-route.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  requireAdmin?: boolean;
  requireAuth?: boolean;
  children: React.ReactNode;
}

export function ProtectedRoute({
  requireAdmin = false,
  requireAuth = false,
  children,
}: ProtectedRouteProps) {
  const { isAuthLoading, isAdmin, isSignedIn } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if ((requireAuth || requireAdmin) && !isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-6xl font-bold text-destructive">403</h1>
      <h2 className="text-2xl font-semibold">Access Denied</h2>
      <p className="text-muted-foreground">
        You do not have permission to access this page.
      </p>
      <Navigate to="/chat" replace />
    </div>
  );
}

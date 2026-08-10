// components/memory/memory-sub-nav.tsx — Memory sub-nav (§2): Overview ·
// Memories · Timeline · Graph · Inbox · Debugger. Debugger is additionally
// gated on memory.debug_retrieval (cosmetic — nav item hidden without it,
// backend re-checks; ROUTES.md).
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/memory/permission-gate";

const NAV_ITEMS = [
  { to: "/memory/overview", label: "Overview", end: false },
  { to: "/memory/memories", label: "Memories", end: false },
  { to: "/memory/timeline", label: "Timeline", end: false },
  { to: "/memory/graph", label: "Graph", end: false },
  { to: "/memory/inbox", label: "Inbox", end: false },
];

const linkClass = (isActive: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function MemorySubNav() {
  return (
    <nav className="flex items-center gap-1 border-b border-border/60 px-4" aria-label="Memory sections">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive)}>
          {item.label}
        </NavLink>
      ))}
      <PermissionGate perm="memory.debug_retrieval">
        <NavLink to="/memory/debugger" className={({ isActive }) => linkClass(isActive)}>
          Debugger
        </NavLink>
      </PermissionGate>
    </nav>
  );
}

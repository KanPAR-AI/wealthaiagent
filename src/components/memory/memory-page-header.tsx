// components/memory/memory-page-header.tsx — MemoryPageHeader (§3):
// persistent header on every Memory page — Back-to-Chat escape, Title,
// SearchInput (⌘K), ScopeSelector, DomainSelector, StatusSelector,
// FilterButton, AddMemoryButton, and an Admin link for admins. The Memory
// routes render OUTSIDE AppLayout (no chat sidebar), so without the escape
// links the section was a dead end — no way back to chat or /admin.
import { Link } from "react-router-dom";
import { ArrowLeft, Wrench } from "lucide-react";
import { MemorySearchInput } from "@/components/memory/memory-search-input";
import { ScopeSelector } from "@/components/memory/scope-selector";
import { DomainSelector } from "@/components/memory/domain-selector";
import { StatusSelector } from "@/components/memory/status-selector";
import { FilterButton } from "@/components/memory/filter-button";
import { AddMemoryButton } from "@/components/memory/add-memory-button";
import { useAuth } from "@/hooks/use-auth";

export function MemoryPageHeader() {
  const { isAdmin } = useAuth();

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
      <Link
        to="/new"
        className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Back to Chat</span>
      </Link>
      <div className="h-4 w-px shrink-0 bg-border" />
      <h1 className="mr-2 text-lg font-semibold shrink-0">Memory</h1>
      <MemorySearchInput />
      <ScopeSelector />
      <DomainSelector />
      <StatusSelector />
      <FilterButton />
      <div className="ml-auto flex items-center gap-2">
        {isAdmin && (
          <Link
            to="/admin"
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Wrench size={14} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <AddMemoryButton />
      </div>
    </header>
  );
}

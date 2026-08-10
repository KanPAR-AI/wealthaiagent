// components/memory/memory-page-header.tsx — MemoryPageHeader (§3):
// persistent header on every Memory page — Title, SearchInput (⌘K),
// ScopeSelector, DomainSelector, StatusSelector, FilterButton,
// AddMemoryButton.
import { MemorySearchInput } from "@/components/memory/memory-search-input";
import { ScopeSelector } from "@/components/memory/scope-selector";
import { DomainSelector } from "@/components/memory/domain-selector";
import { StatusSelector } from "@/components/memory/status-selector";
import { FilterButton } from "@/components/memory/filter-button";
import { AddMemoryButton } from "@/components/memory/add-memory-button";

export function MemoryPageHeader() {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
      <h1 className="mr-2 text-lg font-semibold shrink-0">Memory</h1>
      <MemorySearchInput />
      <ScopeSelector />
      <DomainSelector />
      <StatusSelector />
      <FilterButton />
      <div className="ml-auto">
        <AddMemoryButton />
      </div>
    </header>
  );
}

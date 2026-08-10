// components/memory/memory-search-input.tsx — SearchInput (§3-4).
//
// UI-0 SCOPE: this is the "⌘K stub" named in IMPLEMENTATION_PLAN — it wires
// the URL plumbing (`q` query param, STATE_MODEL "Active filters ... URL")
// and the ⌘K focus shortcut, but does not itself run hybrid search /
// render match-reason results (§4, MUI-0006) — that's UI-1. The Memories
// placeholder screen reads `q` from the URL and performs one real
// round-trip search against it, so typing + Enter here does reach the
// backend today; it just isn't yet the full search experience.
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";

export function MemorySearchInput() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function commit() {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="relative flex-1 min-w-[160px] max-w-sm">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        onBlur={commit}
        placeholder="Search memories…"
        aria-label="Search memories"
        className="pl-8 pr-10 h-8 text-sm"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border/60 px-1 text-[10px] text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </div>
  );
}

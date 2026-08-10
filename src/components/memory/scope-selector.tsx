// components/memory/scope-selector.tsx — ScopeSelector (§3, §5).
//
// ADR-005 (cross-user is OUT of v1): this selector offers ONLY scopes the
// authenticated principal owns. There is no endpoint yet enumerating every
// scope a principal owns (agent/project/org scopes an admin might also
// hold) — until one exists (OPEN_QUESTIONS), the only scope offered is the
// caller's own user scope. This is a deliberately narrow but SAFE default:
// it can never widen to a foreign scope by omission, only grow by an
// explicit future addition once a real owned-scopes source exists.
import { User } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function ScopeSelector() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ownScope = user ? `user:${user.uid}` : "own";
  const current = searchParams.get("scope") || ownScope;

  function selectOwn() {
    const next = new URLSearchParams(searchParams);
    next.set("scope", ownScope);
    setSearchParams(next, { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Scope" className="gap-1.5">
          <User className="size-3.5" aria-hidden="true" />
          My memories
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuRadioGroup value={current} onValueChange={selectOwn}>
          <DropdownMenuRadioItem value={ownScope}>My memories</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Cross-user memory isn&apos;t offered (ADR-005) — only scopes you own appear here.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

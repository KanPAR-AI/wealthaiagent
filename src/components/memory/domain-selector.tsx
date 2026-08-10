// components/memory/domain-selector.tsx — DomainSelector (§3, §5
// Domain/Namespace filter). There is no namespace-listing endpoint yet
// (only a namespace-scoped list requires knowing the namespace up front),
// so rather than fabricate a static pick-list of "known domains" (which
// would be invented data, not backend truth), this is a free-text filter
// over the `namespace` URL param — honest about what's actually known.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";

export function DomainSelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get("namespace") ?? "");

  useEffect(() => {
    setValue(searchParams.get("namespace") ?? "");
  }, [searchParams]);

  function commit() {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("namespace", value.trim());
    else next.delete("namespace");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="memory-domain-filter" className="sr-only">
        Domain
      </label>
      <Input
        id="memory-domain-filter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        onBlur={commit}
        placeholder="All domains"
        className="h-8 w-32 text-xs"
      />
    </div>
  );
}

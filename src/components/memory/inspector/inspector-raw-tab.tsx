// components/memory/inspector/inspector-raw-tab.tsx — Inspector Raw (§19).
// Developer view: the canonical record as JSON, with Copy JSON / Copy ID.
// Gated on memory.read_raw (cosmetically here; the tab is only reachable
// when the permission is present — see the inspector). NO arbitrary JSON
// mutation is possible here; it is read-only (§19). The JSON is rendered in
// a <pre> as escaped text — never executed.
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MemoryRecord } from "@/services/memory-engine-service";

export function InspectorRawTab({ memory }: { memory: MemoryRecord }) {
  const [copied, setCopied] = useState<"json" | "id" | null>(null);
  const json = JSON.stringify(memory, null, 2);

  function copy(what: "json" | "id", text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-2" data-testid="inspector-raw">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy("json", json)}>
          {copied === "json" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          Copy JSON
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy("id", memory.id)}>
          {copied === "id" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          Copy memory ID
        </Button>
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
        <code>{json}</code>
      </pre>
    </div>
  );
}

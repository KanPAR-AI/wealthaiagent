// components/memory/memory-placeholder-screen.tsx — an HONEST "not built
// yet" surface for the sub-routes UI-0 registers but doesn't implement
// (Timeline/Graph/Inbox/Debugger). Never renders fake/mock content — it
// says plainly what ships and when.
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export interface MemoryPlaceholderScreenProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function MemoryPlaceholderScreen({
  title,
  description,
  icon: Icon = Construction,
}: MemoryPlaceholderScreenProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 px-6 py-16 text-center"
      data-testid="memory-placeholder-screen"
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

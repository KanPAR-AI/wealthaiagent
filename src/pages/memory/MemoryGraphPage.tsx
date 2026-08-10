import { Share2 } from "lucide-react";
import { MemoryPlaceholderScreen } from "@/components/memory/memory-placeholder-screen";

export default function MemoryGraphPage() {
  return (
    <MemoryPlaceholderScreen
      icon={Share2}
      title="Graph"
      description="Entity relationships ship in UI-7, backed by a new GET /memory/graph endpoint (MUI-1010) — always a bounded 1-hop neighborhood, never the full tenant graph."
    />
  );
}

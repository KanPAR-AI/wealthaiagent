import { History } from "lucide-react";
import { MemoryPlaceholderScreen } from "@/components/memory/memory-placeholder-screen";

export default function MemoryTimelinePage() {
  return (
    <MemoryPlaceholderScreen
      icon={History}
      title="Timeline"
      description="Historical values and validity periods over time ship in UI-5, backed by a new GET /memory/timeline endpoint (MUI-1011)."
    />
  );
}

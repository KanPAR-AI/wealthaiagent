import { LayoutDashboard } from "lucide-react";
import { MemoryPlaceholderScreen } from "@/components/memory/memory-placeholder-screen";

export default function MemoryOverviewPage() {
  return (
    <MemoryPlaceholderScreen
      icon={LayoutDashboard}
      title="Overview"
      description="Active-memory metrics, memory-by-domain, recent changes, needs-attention, and the memory-activity chart ship in UI-4 over the existing search/list endpoints (MUI-0008/0009)."
    />
  );
}

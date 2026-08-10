import { Bug } from "lucide-react";
import { MemoryPlaceholderScreen } from "@/components/memory/memory-placeholder-screen";

export default function MemoryDebuggerPage() {
  return (
    <MemoryPlaceholderScreen
      icon={Bug}
      title="Retrieval Debugger"
      description="Query + scope + at-time retrieval tracing ships in UI-9, backed by a new POST /memory/debug/retrieve endpoint (MUI-1015) that never leaks an unauthorized candidate."
    />
  );
}

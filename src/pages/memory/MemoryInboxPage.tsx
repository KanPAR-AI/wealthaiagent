import { Inbox as InboxIcon } from "lucide-react";
import { MemoryPlaceholderScreen } from "@/components/memory/memory-placeholder-screen";

export default function MemoryInboxPage() {
  return (
    <MemoryPlaceholderScreen
      icon={InboxIcon}
      title="Inbox"
      description="Inferred candidates and conflicts to review ship in UI-8, backed by a new GET /memory/inbox endpoint (MUI-1012, ADR-003)."
    />
  );
}

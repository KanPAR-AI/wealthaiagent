import { ArrowLeft, MessageSquare, Settings, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/store/admin";
import { AgentStatusBadge } from "@/components/admin/agent-builder/agent-status-badge";

export function AdminHeader() {
  const {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    setShowCreateWizard,
  } = useAdminStore();

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-4">
          <Link
            to="/new"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-muted-foreground" />
            <h1 className="text-sm font-semibold">Admin Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedAgentId || ""}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select Agent
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.is_dynamic && a.status ? ` (${a.status})` : ""}
                  </option>
                ))}
              </select>
              {selectedAgent?.is_dynamic && selectedAgent.status && (
                <AgentStatusBadge status={selectedAgent.status} />
              )}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateWizard(true)}
          >
            <Plus size={14} className="mr-1" />
            Create Agent
          </Button>
          {selectedAgentId && (
            <Link to={`/admin/test/${selectedAgentId}`}>
              <Button size="sm" variant="outline">
                <MessageSquare size={14} className="mr-1" />
                Test Chat
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

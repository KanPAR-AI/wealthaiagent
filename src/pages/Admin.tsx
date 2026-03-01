import { useEffect, useState } from "react";
import { Film, Cpu, DollarSign } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { VideoPanel } from "@/components/admin/video-management/video-panel";
import { ModelConfigPanel } from "@/components/admin/model-config/model-config-panel";
import { CostPanel } from "@/components/admin/cost-dashboard/cost-panel";
import { useAdminStore } from "@/store/admin";
import { fetchAgents } from "@/services/admin-service";

type Tab = "videos" | "model_config" | "cost_dashboard";

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode }> = {
  videos: { label: "Videos", icon: <Film size={14} /> },
  model_config: { label: "Models", icon: <Cpu size={14} /> },
  cost_dashboard: { label: "Costs", icon: <DollarSign size={14} /> },
};

export default function Admin() {
  const { agents, selectedAgentId, setAgents, setSelectedAgentId } =
    useAdminStore();
  const [activeTab, setActiveTab] = useState<Tab>("videos");
  const [error, setError] = useState<string | null>(null);

  // Load agents on mount
  useEffect(() => {
    fetchAgents()
      .then((data) => {
        setAgents(data.agents);
        // Auto-select first agent if none selected
        if (!selectedAgentId && data.agents.length > 0) {
          setSelectedAgentId(data.agents[0].id);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const capabilities = selectedAgent?.capabilities || [];

  // Reset tab if current tab not available for selected agent
  useEffect(() => {
    if (capabilities.length > 0 && !capabilities.includes(activeTab)) {
      setActiveTab(capabilities[0] as Tab);
    }
  }, [selectedAgentId, capabilities, activeTab]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load admin portal</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {selectedAgent ? (
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Agent info */}
          <div className="mb-6">
            <h2 className="text-xl font-bold">{selectedAgent.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedAgent.description}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border mb-6">
            {capabilities.map((cap) => {
              const meta = TAB_META[cap as Tab];
              if (!meta) return null;
              return (
                <button
                  key={cap}
                  onClick={() => setActiveTab(cap as Tab)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === cap
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "videos" && capabilities.includes("videos") && (
            <VideoPanel agentId={selectedAgentId!} />
          )}
          {activeTab === "model_config" && capabilities.includes("model_config") && (
            <ModelConfigPanel agentId={selectedAgentId!} />
          )}
          {activeTab === "cost_dashboard" && capabilities.includes("cost_dashboard") && (
            <CostPanel agentId={selectedAgentId!} />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
          Select an agent from the dropdown above to get started.
        </div>
      )}
    </div>
  );
}

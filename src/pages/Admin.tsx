import { useEffect, useState } from "react";
import {
  Film,
  Cpu,
  DollarSign,
  UtensilsCrossed,
  Database,
  Brain,
  FileText,
  Route,
  HardDrive,
  BookOpen,
  Bot,
  FlaskConical,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { VideoPanel } from "@/components/admin/video-management/video-panel";
import { ModelConfigPanel } from "@/components/admin/model-config/model-config-panel";
import { CostPanel } from "@/components/admin/cost-dashboard/cost-panel";
import { DishPanel } from "@/components/admin/dish-library/dish-panel";
import { CorpusPanel } from "@/components/admin/rag-corpus/corpus-panel";
import { UserMemoryPanel } from "@/components/admin/user-memory/user-memory-panel";
import { PromptEditor } from "@/components/admin/agent-builder/prompt-editor";
import { RoutingConfig } from "@/components/admin/agent-builder/routing-config";
import { MemoryConfigPanel } from "@/components/admin/agent-builder/memory-config";
import { OntologyEditor } from "@/components/admin/agent-builder/ontology-editor";
import { AgentCreationWizard } from "@/components/admin/agent-builder/agent-creation-wizard";
import { AgentDraftScreen } from "@/components/admin/agent-builder/agent-draft-screen";
import { AgentStatusBadge } from "@/components/admin/agent-builder/agent-status-badge";
import { AgentBuilderChat } from "@/components/admin/agent-builder/agent-builder-chat";
import { SandboxPanel } from "@/components/admin/agent-builder/sandbox-panel";
import { useAdminStore } from "@/store/admin";
import { fetchAgents } from "@/services/admin-service";

type Tab =
  | "videos"
  | "model_config"
  | "cost_dashboard"
  | "dish_library"
  | "rag_corpus"
  | "user_memory"
  | "prompt_editor"
  | "routing_config"
  | "memory_config"
  | "ontology"
  | "agent_builder"
  | "sandbox";

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode }> = {
  videos: { label: "Videos", icon: <Film size={14} /> },
  model_config: { label: "Models", icon: <Cpu size={14} /> },
  cost_dashboard: { label: "Costs", icon: <DollarSign size={14} /> },
  dish_library: { label: "Dishes", icon: <UtensilsCrossed size={14} /> },
  rag_corpus: { label: "Corpus", icon: <Database size={14} /> },
  user_memory: { label: "Memory", icon: <Brain size={14} /> },
  prompt_editor: { label: "Prompts", icon: <FileText size={14} /> },
  routing_config: { label: "Routing", icon: <Route size={14} /> },
  memory_config: { label: "Mem Config", icon: <HardDrive size={14} /> },
  ontology: { label: "Ontology", icon: <BookOpen size={14} /> },
  agent_builder: { label: "AI Builder", icon: <Bot size={14} /> },
  sandbox: { label: "Sandbox", icon: <FlaskConical size={14} /> },
};

export default function Admin() {
  const {
    agents,
    selectedAgentId,
    setAgents,
    setSelectedAgentId,
    showCreateWizard,
    setShowCreateWizard,
  } = useAdminStore();
  const [activeTab, setActiveTab] = useState<Tab>("videos");
  const [error, setError] = useState<string | null>(null);
  // Phase 1C: goal-first draft screen is the default create flow.
  // The legacy 4-step wizard is still reachable via "Advanced: manual
  // create" link inside the draft screen — flips this flag to true.
  const [useManualWizard, setUseManualWizard] = useState(false);

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
          <p className="text-destructive font-medium">
            Failed to load admin portal
          </p>
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
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{selectedAgent.name}</h2>
              {selectedAgent.is_dynamic && selectedAgent.status && (
                <AgentStatusBadge status={selectedAgent.status} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedAgent.description}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
            {capabilities.map((cap) => {
              const meta = TAB_META[cap as Tab];
              if (!meta) return null;
              return (
                <button
                  key={cap}
                  onClick={() => setActiveTab(cap as Tab)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
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
          {activeTab === "model_config" &&
            capabilities.includes("model_config") && (
              <ModelConfigPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "cost_dashboard" &&
            capabilities.includes("cost_dashboard") && (
              <CostPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "dish_library" &&
            capabilities.includes("dish_library") && (
              <DishPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "rag_corpus" &&
            capabilities.includes("rag_corpus") && (
              <CorpusPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "user_memory" &&
            capabilities.includes("user_memory") && (
              <UserMemoryPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "prompt_editor" &&
            capabilities.includes("prompt_editor") && (
              <PromptEditor agentId={selectedAgentId!} />
            )}
          {activeTab === "routing_config" &&
            capabilities.includes("routing_config") && (
              <RoutingConfig agentId={selectedAgentId!} />
            )}
          {activeTab === "memory_config" &&
            capabilities.includes("memory_config") && (
              <MemoryConfigPanel agentId={selectedAgentId!} />
            )}
          {activeTab === "ontology" && capabilities.includes("ontology") && (
            <OntologyEditor agentId={selectedAgentId!} />
          )}
          {activeTab === "agent_builder" &&
            capabilities.includes("agent_builder") && (
              <AgentBuilderChat agentId={selectedAgentId!} />
            )}
          {activeTab === "sandbox" && capabilities.includes("sandbox") && (
            <SandboxPanel agentId={selectedAgentId!} />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
          Select an agent from the dropdown above to get started.
        </div>
      )}

      {/* Creation flow: goal-first draft screen by default,
          legacy 4-step wizard reachable via "Advanced" link */}
      {showCreateWizard && !useManualWizard && (
        <AgentDraftScreen
          onClose={() => {
            setShowCreateWizard(false);
            setUseManualWizard(false);
          }}
          onOpenManualWizard={() => setUseManualWizard(true)}
        />
      )}
      {showCreateWizard && useManualWizard && (
        <AgentCreationWizard
          onClose={() => {
            setShowCreateWizard(false);
            setUseManualWizard(false);
          }}
        />
      )}
    </div>
  );
}

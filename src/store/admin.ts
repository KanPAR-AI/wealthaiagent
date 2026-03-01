// store/admin.ts
// Zustand store for admin portal state

import { create } from "zustand";
import type {
  AgentInfo,
  VideoListResponse,
  ModelConfigResponse,
  CostResponse,
  VideoJob,
} from "@/services/admin-service";

interface AdminState {
  // Agent selection
  agents: AgentInfo[];
  selectedAgentId: string | null;
  setAgents: (agents: AgentInfo[]) => void;
  setSelectedAgentId: (id: string) => void;

  // Videos
  videoData: VideoListResponse | null;
  setVideoData: (data: VideoListResponse | null) => void;
  activeJob: VideoJob | null;
  setActiveJob: (job: VideoJob | null) => void;

  // Model config
  modelConfig: ModelConfigResponse | null;
  setModelConfig: (config: ModelConfigResponse | null) => void;

  // Costs
  costData: CostResponse | null;
  costPeriod: "1d" | "7d" | "30d";
  setCostData: (data: CostResponse | null) => void;
  setCostPeriod: (period: "1d" | "7d" | "30d") => void;

  // Loading
  loading: Record<string, boolean>;
  setLoading: (key: string, val: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  agents: [],
  selectedAgentId: null,
  setAgents: (agents) => set({ agents }),
  setSelectedAgentId: (id) =>
    set({ selectedAgentId: id, videoData: null, modelConfig: null, costData: null }),

  videoData: null,
  setVideoData: (data) => set({ videoData: data }),
  activeJob: null,
  setActiveJob: (job) => set({ activeJob: job }),

  modelConfig: null,
  setModelConfig: (config) => set({ modelConfig: config }),

  costData: null,
  costPeriod: "7d",
  setCostData: (data) => set({ costData: data }),
  setCostPeriod: (period) => set({ costPeriod: period }),

  loading: {},
  setLoading: (key, val) =>
    set((s) => ({ loading: { ...s.loading, [key]: val } })),
}));

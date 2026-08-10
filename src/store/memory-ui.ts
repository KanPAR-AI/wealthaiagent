// store/memory-ui.ts — ephemeral Memory OS UI chrome (STATE_MODEL
// "Ownership map": inspector open + active tab is zustand, ephemeral,
// non-authoritative). Everything else (filters/selection) is URL-owned;
// everything about memory content is backend-owned. This store holds
// NEITHER — it only tracks whether the inspector drawer is open and which
// tab it's on, seeded (non-authoritatively) by a `?tab=` query param when
// the inspector itself ships (UI-2).
import { create } from "zustand";

export type MemoryInspectorTab = "details" | "evidence" | "history" | "usage" | "raw";

interface MemoryUiState {
  inspectorOpen: boolean;
  inspectorTab: MemoryInspectorTab;
  openInspector: (tab?: MemoryInspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (tab: MemoryInspectorTab) => void;
}

export const useMemoryUiStore = create<MemoryUiState>((set) => ({
  inspectorOpen: false,
  inspectorTab: "details",
  openInspector: (tab = "details") => set({ inspectorOpen: true, inspectorTab: tab }),
  closeInspector: () => set({ inspectorOpen: false }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
}));

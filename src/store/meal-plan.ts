import { create } from "zustand";
import type { StructuredMealPlan } from "@/types/meal-plan";

interface MealPlanState {
  plan: StructuredMealPlan | null;
  selectedDay: number; // 0-6
  loading: boolean;
  swappingMeal: { day: number; meal: number } | null;
  error: string | null;

  setPlan: (plan: StructuredMealPlan | null) => void;
  setSelectedDay: (day: number) => void;
  setLoading: (loading: boolean) => void;
  setSwappingMeal: (swapping: { day: number; meal: number } | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMealPlanStore = create<MealPlanState>((set) => ({
  plan: null,
  selectedDay: 0,
  loading: false,
  swappingMeal: null,
  error: null,

  setPlan: (plan) => set({ plan, error: null }),
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  setLoading: (loading) => set({ loading }),
  setSwappingMeal: (swappingMeal) => set({ swappingMeal }),
  setError: (error) => set({ error, loading: false }),
  reset: () => set({ plan: null, selectedDay: 0, loading: false, swappingMeal: null, error: null }),
}));

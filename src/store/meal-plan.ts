import { create } from "zustand";
import type { StructuredMealPlan } from "@/types/meal-plan";
import { getPlanDayDates, getTodayIndex } from "@/components/meal-plan/date-utils";

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

  setPlan: (plan) => {
    let selectedDay = 0;
    if (plan?.created_at) {
      const dates = getPlanDayDates(plan.created_at);
      const todayIdx = getTodayIndex(dates);
      if (todayIdx !== null) selectedDay = todayIdx;
    }
    set({ plan, error: null, selectedDay });
  },
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  setLoading: (loading) => set({ loading }),
  setSwappingMeal: (swappingMeal) => set({ swappingMeal }),
  setError: (error) => set({ error, loading: false }),
  reset: () => set({ plan: null, selectedDay: 0, loading: false, swappingMeal: null, error: null }),
}));

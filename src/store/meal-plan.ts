import { create } from "zustand";
import type { StructuredMealPlan, StaleMealInfo } from "@/types/meal-plan";
import { getPlanDayDates, getTodayIndex } from "@/components/meal-plan/date-utils";

interface MealPlanState {
  plan: StructuredMealPlan | null;
  selectedDay: number; // 0-6
  loading: boolean;
  swappingMeal: { day: number; meal: number } | null;
  error: string | null;
  planStale: boolean;
  staleMeals: StaleMealInfo[];

  setPlan: (plan: StructuredMealPlan | null) => void;
  setSelectedDay: (day: number) => void;
  setLoading: (loading: boolean) => void;
  setSwappingMeal: (swapping: { day: number; meal: number } | null) => void;
  setError: (error: string | null) => void;
  setPlanStale: (stale: boolean, meals: StaleMealInfo[]) => void;
  clearStale: () => void;
  reset: () => void;
}

export const useMealPlanStore = create<MealPlanState>((set) => ({
  plan: null,
  selectedDay: 0,
  loading: false,
  swappingMeal: null,
  error: null,
  planStale: false,
  staleMeals: [],

  setPlan: (plan) => {
    let selectedDay = 0;
    if (plan?.created_at) {
      const dates = getPlanDayDates(plan.created_at);
      const todayIdx = getTodayIndex(dates);
      if (todayIdx !== null) selectedDay = todayIdx;
    }
    set({ plan, error: null, selectedDay, planStale: false, staleMeals: [] });
  },
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  setLoading: (loading) => set({ loading }),
  setSwappingMeal: (swappingMeal) => set({ swappingMeal }),
  setError: (error) => set({ error, loading: false }),
  setPlanStale: (planStale, staleMeals) => set({ planStale, staleMeals }),
  clearStale: () => set({ planStale: false, staleMeals: [] }),
  reset: () => set({ plan: null, selectedDay: 0, loading: false, swappingMeal: null, error: null, planStale: false, staleMeals: [] }),
}));

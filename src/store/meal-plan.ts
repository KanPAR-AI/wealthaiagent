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

  // Week navigation state
  currentWeek: number; // 1-52
  generatedWeeks: number[];
  planGroupId: string | null;
  planGroupCreatedAt: string | null; // week 1's created_at — base for all date calculations
  weekLoading: boolean;

  setPlan: (plan: StructuredMealPlan | null) => void;
  setSelectedDay: (day: number) => void;
  setLoading: (loading: boolean) => void;
  setSwappingMeal: (swapping: { day: number; meal: number } | null) => void;
  setError: (error: string | null) => void;
  setPlanStale: (stale: boolean, meals: StaleMealInfo[]) => void;
  clearStale: () => void;
  setCurrentWeek: (week: number) => void;
  setWeekLoading: (loading: boolean) => void;
  setGeneratedWeeks: (weeks: number[]) => void;
  setPlanGroupId: (id: string | null) => void;
  setPlanGroupCreatedAt: (createdAt: string | null) => void;
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
  currentWeek: 1,
  generatedWeeks: [],
  planGroupId: null,
  planGroupCreatedAt: null,
  weekLoading: false,

  setPlan: (plan) => {
    let selectedDay = 0;
    if (plan?.created_at) {
      const dates = getPlanDayDates(plan.created_at);
      const todayIdx = getTodayIndex(dates);
      if (todayIdx !== null) selectedDay = todayIdx;
    }
    set((state) => ({
      plan,
      error: null,
      selectedDay,
      planStale: false,
      staleMeals: [],
      currentWeek: plan?.week_number ?? 1,
      planGroupId: plan?.plan_group_id ?? null,
      // Set planGroupCreatedAt when loading week 1, preserve it for other weeks
      planGroupCreatedAt:
        (plan?.week_number ?? 1) === 1
          ? (plan?.created_at ?? null)
          : (state.planGroupCreatedAt ?? plan?.created_at ?? null),
    }));
  },
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  setLoading: (loading) => set({ loading }),
  setSwappingMeal: (swappingMeal) => set({ swappingMeal }),
  setError: (error) => set({ error, loading: false }),
  setPlanStale: (planStale, staleMeals) => set({ planStale, staleMeals }),
  clearStale: () => set({ planStale: false, staleMeals: [] }),
  setCurrentWeek: (currentWeek) => set({ currentWeek }),
  setWeekLoading: (weekLoading) => set({ weekLoading }),
  setGeneratedWeeks: (generatedWeeks) => set({ generatedWeeks }),
  setPlanGroupId: (planGroupId) => set({ planGroupId }),
  setPlanGroupCreatedAt: (planGroupCreatedAt) => set({ planGroupCreatedAt }),
  reset: () => set({
    plan: null, selectedDay: 0, loading: false, swappingMeal: null, error: null,
    planStale: false, staleMeals: [],
    currentWeek: 1, generatedWeeks: [], planGroupId: null, planGroupCreatedAt: null, weekLoading: false,
  }),
}));

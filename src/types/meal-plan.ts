// TypeScript interfaces matching backend Pydantic models for meal plans

export interface MealPlanItem {
  name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: "database" | "estimated";
}

export interface NutrientTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface MealPlanMeal {
  meal_type: string;
  name: string;
  items: MealPlanItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  prep_notes?: string;
}

export interface MealPlanDay {
  day: string;
  meals: MealPlanMeal[];
  daily_totals: NutrientTotals;
}

export interface StructuredMealPlan {
  id: string;
  chat_id: string;
  created_at: string;
  days: MealPlanDay[];
  weekly_averages: NutrientTotals;
  targets: NutrientTotals;
}

export interface SwapMealRequest {
  plan_id: string;
  day_index: number;
  meal_index: number;
}

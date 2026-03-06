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

// Smart swap types

export type SwapMode = "auto" | "custom";

export interface SmartSwapRequest {
  plan_id: string;
  day_index: number;
  meal_index: number;
  mode: SwapMode;
  food_text?: string;
  file_url?: string;
}

export interface NutrientDelta {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface CompensationAdjustment {
  day_index: number;
  day_name: string;
  meal_index: number;
  meal_name: string;
  original_calories: number;
  adjusted_calories: number;
  scale_factor: number;
}

export interface SwapChangeSummary {
  swapped_meal: {
    day_name: string;
    meal_type: string;
    original_name: string;
    new_name: string;
    delta: NutrientDelta;
  };
  compensations: CompensationAdjustment[];
  updated_weekly_averages: NutrientTotals;
  targets: NutrientTotals;
}

export interface SmartSwapResponse {
  plan: StructuredMealPlan;
  changes: SwapChangeSummary;
}

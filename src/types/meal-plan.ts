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
  template_id?: string;
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
  original_meal_name: string;
  new_meal_name: string;
  original_calories: number;
  new_calories: number;
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

// Fix Plan types

export interface NutrientGapInfo {
  before_pct: number;
  after_pct: number;
  status: "fixed" | "improved" | "unchanged";
}

export interface FixPlanSummary {
  nutrient_gaps: Record<string, NutrientGapInfo>;
  days_fixed: number[];
  supplements_suggested: string[];
  medical_notes: string[];
}

export interface FixPlanResponse {
  plan: StructuredMealPlan;
  fix_summary: FixPlanSummary;
}

// Meal Preferences (Likeability)

export type MealRatingValue = 1 | 2 | 3 | 4 | 5;

export interface StaleMealInfo {
  day_index: number;
  meal_index: number;
  day_name: string;
  meal_name: string;
  template_id: string;
  reason: string;
}

export interface MealPreferences {
  ratings: Record<string, MealRatingValue>;
}

export interface MealPreferencesResponse {
  ratings: Record<string, number>;
  plan_stale: boolean;
  stale_meals: StaleMealInfo[];
}

export interface SetPreferencesRequest {
  ratings: Record<string, number>;
}

// Add Meal types

export interface AddMealRequest {
  plan_id: string;
  day_index: number;
  food_text?: string;
  file_url?: string;
}

export interface AddMealResponse {
  plan: StructuredMealPlan;
  added_meal: MealPlanMeal;
}

// Plan Versioning types

export interface PlanVersion {
  id: string;
  action: string;
  created_at: string;
}

export interface PlanVersionsResponse {
  versions: PlanVersion[];
}

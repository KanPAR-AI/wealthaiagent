import { getApiUrl } from "@/config/environment";
import type {
  StructuredMealPlan,
  SwapMealRequest,
  SmartSwapRequest,
  SmartSwapResponse,
  FixPlanResponse,
  MealPreferences,
  MealPreferencesResponse,
  SetPreferencesRequest,
  AddMealRequest,
  AddMealResponse,
  PlanVersionsResponse,
} from "@/types/meal-plan";

export async function fetchMealPlan(
  token: string,
  chatId: string
): Promise<StructuredMealPlan> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("No meal plan found");
    throw new Error(`Failed to fetch meal plan: ${response.statusText}`);
  }
  return response.json();
}

export async function generateMealPlan(
  token: string,
  chatId: string
): Promise<StructuredMealPlan> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to generate meal plan: ${response.statusText}`);
  }
  return response.json();
}

export async function swapMeal(
  token: string,
  chatId: string,
  request: SwapMealRequest
): Promise<StructuredMealPlan> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/swap`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to swap meal: ${response.statusText}`);
  }
  return response.json();
}

export async function smartSwapMeal(
  token: string,
  chatId: string,
  request: SmartSwapRequest
): Promise<SmartSwapResponse> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/swap`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to swap meal: ${response.statusText}`);
  }
  return response.json();
}

export async function fixMealPlan(
  token: string,
  chatId: string,
  planId: string,
  targetWeightKg?: number,
): Promise<FixPlanResponse> {
  const body: Record<string, unknown> = { plan_id: planId };
  if (targetWeightKg !== undefined) body.target_weight_kg = targetWeightKg;

  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/fix`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to fix meal plan: ${response.statusText}`);
  }
  return response.json();
}

export async function getMealPreferences(
  token: string,
  chatId: string
): Promise<MealPreferences> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/preferences`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 404) return { ratings: {} };
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }
  return response.json();
}

export async function setMealPreferences(
  token: string,
  chatId: string,
  ratings: Record<string, number>
): Promise<MealPreferencesResponse> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/preferences`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ratings } satisfies SetPreferencesRequest),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to set preferences: ${response.statusText}`);
  }
  return response.json();
}

export async function uploadFile(
  token: string,
  file: File
): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append("files", file, file.name);

  const response = await fetch(getApiUrl("/files/upload"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload file");
  const data = await response.json();
  const uploaded = data.files[0];
  return { url: getApiUrl(uploaded.url), name: uploaded.fileName };
}

export async function addMeal(
  token: string,
  chatId: string,
  request: AddMealRequest
): Promise<AddMealResponse> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/add-meal`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to add meal: ${response.statusText}`);
  }
  return response.json();
}

export async function getCustomMeals(
  token: string,
  chatId: string
): Promise<{ custom_meals: Record<string, unknown>[] }> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/custom-meals`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 404) return { custom_meals: [] };
    throw new Error(`Failed to fetch custom meals: ${response.statusText}`);
  }
  return response.json();
}

export async function getPlanVersions(
  token: string,
  chatId: string,
  planId: string
): Promise<PlanVersionsResponse> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/${planId}/versions`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch versions: ${response.statusText}`);
  }
  return response.json();
}

export async function restoreVersion(
  token: string,
  chatId: string,
  planId: string,
  versionId: string
): Promise<{ plan: StructuredMealPlan }> {
  const response = await fetch(getApiUrl(`/chats/${chatId}/mealplan/${planId}/versions/${versionId}/restore`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to restore version: ${response.statusText}`);
  }
  return response.json();
}

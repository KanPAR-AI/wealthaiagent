import { getApiUrl } from "@/config/environment";
import type { StructuredMealPlan, SwapMealRequest, SmartSwapRequest, SmartSwapResponse } from "@/types/meal-plan";

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

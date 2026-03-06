import { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMealPlanStore } from "@/store/meal-plan";
import { fetchMealPlan, generateMealPlan } from "@/services/meal-plan-service";
import { DayTabs } from "@/components/meal-plan/day-tabs";
import { MealCard } from "@/components/meal-plan/meal-card";
import { DailyTotals } from "@/components/meal-plan/daily-totals";
import { WeeklySummary } from "@/components/meal-plan/weekly-summary";
import { SwapDialog } from "@/components/meal-plan/swap-dialog";
import type { SmartSwapResponse } from "@/types/meal-plan";

export default function MealPlan() {
  const { chatid } = useParams<{ chatid: string }>();
  const navigate = useNavigate();
  const { idToken, isAuthLoading } = useAuth();
  const {
    plan,
    selectedDay,
    loading,
    error,
    setPlan,
    setLoading,
    setError,
    reset,
  } = useMealPlanStore();

  // Swap dialog state
  const [swapTarget, setSwapTarget] = useState<{ day: number; meal: number } | null>(null);

  // Load meal plan on mount
  useEffect(() => {
    if (!chatid || !idToken) return;

    let cancelled = false;
    setLoading(true);

    fetchMealPlan(idToken, chatid)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatid, idToken, setPlan, setLoading, setError]);

  // Cleanup on unmount
  useEffect(() => () => reset(), [reset]);

  const handleRefresh = useCallback(async () => {
    if (!chatid || !idToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateMealPlan(idToken, chatid);
      setPlan(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }, [chatid, idToken, setPlan, setLoading, setError]);

  const handleSwapClick = useCallback((dayIndex: number, mealIndex: number) => {
    setSwapTarget({ day: dayIndex, meal: mealIndex });
  }, []);

  const handleSwapComplete = useCallback((response: SmartSwapResponse) => {
    setPlan(response.plan);
  }, [setPlan]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentDay = plan?.days[selectedDay];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/chat/${chatid}`)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to Chat
            </button>
            <h1 className="text-lg font-semibold text-foreground">Your 7-Day Meal Plan</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? "Generating..." : "Refresh Plan"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
              {error}
              {error.includes("No meal plan") && (
                <button
                  onClick={handleRefresh}
                  className="ml-2 underline font-medium"
                >
                  Generate one now
                </button>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && !plan && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Plan content */}
          {plan && (
            <>
              {/* Day tabs */}
              <DayTabs />

              {/* Main layout: meals + sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Meals column (2/3) */}
                <div className="lg:col-span-2 space-y-3">
                  {currentDay?.meals.map((meal, mealIdx) => (
                    <MealCard
                      key={`${selectedDay}-${mealIdx}`}
                      meal={meal}
                      dayIndex={selectedDay}
                      mealIndex={mealIdx}
                      onSwapClick={handleSwapClick}
                    />
                  ))}
                </div>

                {/* Sidebar (1/3) */}
                <div className="space-y-4">
                  {currentDay && (
                    <DailyTotals
                      totals={currentDay.daily_totals}
                      targets={plan.targets}
                      dayName={currentDay.day}
                    />
                  )}
                  <WeeklySummary
                    averages={plan.weekly_averages}
                    targets={plan.targets}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => navigate(`/chat/${chatid}`)}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors text-sm font-medium z-50"
      >
        Chat with AI
      </button>

      {/* Swap Dialog */}
      {swapTarget && plan && currentDay && (
        <SwapDialog
          open={!!swapTarget}
          onOpenChange={(open) => { if (!open) setSwapTarget(null); }}
          meal={currentDay.meals[swapTarget.meal]}
          dayIndex={swapTarget.day}
          mealIndex={swapTarget.meal}
          dayName={currentDay.day}
          planId={plan.id}
          chatId={chatid!}
          onSwapComplete={handleSwapComplete}
        />
      )}
    </div>
  );
}

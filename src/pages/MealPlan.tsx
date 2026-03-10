import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMealPlanStore } from "@/store/meal-plan";
import { fetchMealPlan, generateMealPlan, getMealPreferences, setMealPreferences, addMeal, fetchWeeksMeta } from "@/services/meal-plan-service";
import { DayTabs } from "@/components/meal-plan/day-tabs";
import { MealCard } from "@/components/meal-plan/meal-card";
import { DailyTotals } from "@/components/meal-plan/daily-totals";
import { WeeklySummary } from "@/components/meal-plan/weekly-summary";
import { VarietyScoreCard } from "@/components/meal-plan/variety-score";
import { StalenessNudges } from "@/components/meal-plan/staleness-nudges";
import { CuisineSettings } from "@/components/meal-plan/cuisine-settings";
import { Recommendations } from "@/components/meal-plan/recommendations";
import { WeekNav } from "@/components/meal-plan/week-nav";
import { SwapDialog } from "@/components/meal-plan/swap-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatWindow from "@/components/chat/chat-window";
import type { SmartSwapResponse, StructuredMealPlan, MealRatingValue } from "@/types/meal-plan";

export default function MealPlan() {
  const { chatid } = useParams<{ chatid: string }>();
  const navigate = useNavigate();
  const { idToken, isAuthLoading } = useAuth();
  const {
    plan,
    selectedDay,
    loading,
    error,
    planStale,
    staleMeals,
    currentWeek,
    generatedWeeks,
    weekLoading,
    setPlan,
    setLoading,
    setError,
    setPlanStale,
    clearStale,
    setCurrentWeek,
    setWeekLoading,
    setGeneratedWeeks,
    setPlanGroupId,
    reset,
  } = useMealPlanStore();

  // Swap dialog state
  const [swapTarget, setSwapTarget] = useState<{ day: number; meal: number } | null>(null);

  // Chat sheet state
  const [chatOpen, setChatOpen] = useState(false);

  // Add meal state
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [addMealText, setAddMealText] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  // Meal preferences (likeability ratings)
  const [preferences, setPreferences] = useState<Record<string, number>>({});
  const prefsLoaded = useRef(false);

  // Load meal plan + preferences + weeks meta on mount
  useEffect(() => {
    if (!chatid || !idToken) return;

    let cancelled = false;
    setLoading(true);

    // Load plan, preferences, and weeks meta in parallel
    Promise.all([
      fetchMealPlan(idToken, chatid),
      prefsLoaded.current
        ? Promise.resolve(null)
        : getMealPreferences(idToken, chatid).catch(() => ({ ratings: {} })),
      fetchWeeksMeta(idToken, chatid).catch(() => null),
    ])
      .then(([planData, prefsData, weeksMeta]) => {
        if (cancelled) return;
        setPlan(planData);
        if (prefsData) {
          setPreferences(prefsData.ratings || {});
          prefsLoaded.current = true;
        }
        if (weeksMeta) {
          setGeneratedWeeks(weeksMeta.generated_weeks);
          setPlanGroupId(weeksMeta.plan_group_id);
        }
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
  }, [chatid, idToken, setPlan, setLoading, setError, setGeneratedWeeks, setPlanGroupId]);

  // Cleanup on unmount
  useEffect(() => () => reset(), [reset]);

  const handleRefresh = useCallback(async () => {
    if (!chatid || !idToken) return;
    setLoading(true);
    setError(null);
    clearStale();
    try {
      const data = await generateMealPlan(idToken, chatid, undefined, 12);
      setPlan(data);
      // Refresh weeks metadata (batch generation stores all 12 weeks)
      const weeksMeta = await fetchWeeksMeta(idToken, chatid).catch(() => null);
      if (weeksMeta) {
        setGeneratedWeeks(weeksMeta.generated_weeks);
        setPlanGroupId(weeksMeta.plan_group_id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }, [chatid, idToken, setPlan, setLoading, setError, clearStale, setGeneratedWeeks, setPlanGroupId]);

  const handleWeekChange = useCallback(async (newWeek: number) => {
    if (!chatid || !idToken) return;
    setCurrentWeek(newWeek);
    setWeekLoading(true);
    setError(null);
    try {
      const data = await fetchMealPlan(idToken, chatid, newWeek);
      setPlan(data);
    } catch {
      // Week not generated yet — generate on demand
      try {
        const data = await generateMealPlan(idToken, chatid, newWeek);
        setPlan(data);
        // Update generated weeks list
        setGeneratedWeeks([...new Set([...generatedWeeks, newWeek])].sort((a, b) => a - b));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to generate week");
      }
    } finally {
      setWeekLoading(false);
    }
  }, [chatid, idToken, generatedWeeks, setPlan, setCurrentWeek, setWeekLoading, setError, setGeneratedWeeks]);

  const handleSwapClick = useCallback((dayIndex: number, mealIndex: number) => {
    setSwapTarget({ day: dayIndex, meal: mealIndex });
  }, []);

  const handleSwapComplete = useCallback((response: SmartSwapResponse) => {
    setPlan(response.plan);
  }, [setPlan]);

  const handleFixComplete = useCallback((updatedPlan: unknown) => {
    setPlan(updatedPlan as StructuredMealPlan);
  }, [setPlan]);

  const handleRate = useCallback((mealName: string, value: MealRatingValue) => {
    if (!chatid || !idToken) return;
    // Optimistic update
    setPreferences((prev) => ({ ...prev, [mealName]: value }));
    // Persist to backend and check staleness
    setMealPreferences(idToken, chatid, { [mealName]: value })
      .then((res) => {
        if (res.plan_stale) {
          setPlanStale(true, res.stale_meals || []);
        }
      })
      .catch(() => {
        // Revert on error
        setPreferences((prev) => {
          const next = { ...prev };
          delete next[mealName];
          return next;
        });
      });
  }, [chatid, idToken, setPlanStale]);

  const handleAddMeal = useCallback(async () => {
    if (!chatid || !idToken || !plan || !addMealText.trim()) return;
    setAddingMeal(true);
    try {
      const result = await addMeal(idToken, chatid, {
        plan_id: plan.id,
        day_index: selectedDay,
        food_text: addMealText.trim(),
      });
      setPlan(result.plan);
      setAddMealText("");
      setAddMealOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add meal");
    } finally {
      setAddingMeal(false);
    }
  }, [chatid, idToken, plan, selectedDay, addMealText, setPlan, setError]);

  // Build context prompt so the AI knows about the current meal plan
  const contextPrompt = plan
    ? `[CONTEXT: The user is viewing their 7-day meal plan dashboard. Current targets: ${plan.targets.calories} kcal, ${plan.targets.protein_g}g protein, ${plan.targets.carbs_g}g carbs, ${plan.targets.fat_g}g fat. Weekly averages: ${plan.weekly_averages.calories} kcal, ${plan.weekly_averages.protein_g}g protein. The user can ask to adjust targets (e.g. "increase protein to 120g"), ask about their vitamin/supplement needs, or ask questions about their diet. Your name is Barbie. Respond as their personal nutrition advisor Barbie.]\n\nUser message:`
    : undefined;

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
            <h1 className="text-lg font-semibold text-foreground">Your Meal Plan</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 ${planStale ? "animate-pulse bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400" : ""}`}
          >
            {loading ? "Generating..." : planStale ? "Regenerate Plan" : "Refresh Plan"}
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

          {/* Staleness banner */}
          {planStale && staleMeals.length > 0 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Your preferences changed — {staleMeals.length} meal{staleMeals.length > 1 ? "s" : ""} affected.
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                {staleMeals.map(m => m.meal_name).join(", ")} — {staleMeals[0]?.reason}
              </p>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                Regenerate Plan
              </button>
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
              {/* Week navigation */}
              <WeekNav totalWeeks={52} onWeekChange={handleWeekChange} />

              {/* Day navigation */}
              <div className="space-y-1.5">
                <DayTabs />
              </div>

              {/* Main layout: meals + sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Meals column (2/3) */}
                <div className="lg:col-span-2 space-y-3">
                  {currentDay?.meals.map((meal, mealIdx) => {
                    // Use template_id for preference key (matches planner lookup)
                    const mealKey = meal.template_id
                      ?? meal.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                    return (
                      <MealCard
                        key={`${selectedDay}-${mealIdx}`}
                        meal={meal}
                        dayIndex={selectedDay}
                        mealIndex={mealIdx}
                        onSwapClick={handleSwapClick}
                        rating={preferences[mealKey] as MealRatingValue | undefined}
                        onRate={(value) => handleRate(mealKey, value)}
                      />
                    );
                  })}

                  {/* Add Meal */}
                  {!addMealOpen ? (
                    <button
                      onClick={() => setAddMealOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add a meal
                    </button>
                  ) : (
                    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                      <p className="text-sm font-medium text-foreground">Add a meal to {currentDay?.day}</p>
                      <textarea
                        value={addMealText}
                        onChange={(e) => setAddMealText(e.target.value)}
                        placeholder="Describe what you ate, e.g. '2 rotis with dal and salad'"
                        rows={2}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddMeal}
                          disabled={addingMeal || !addMealText.trim()}
                          className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {addingMeal ? "Adding..." : "Add"}
                        </button>
                        <button
                          onClick={() => { setAddMealOpen(false); setAddMealText(""); }}
                          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
                  {plan.variety_score && (
                    <VarietyScoreCard varietyScore={plan.variety_score} />
                  )}
                  {plan.staleness_nudges && plan.staleness_nudges.length > 0 && (
                    <StalenessNudges nudges={plan.staleness_nudges} />
                  )}
                  <WeeklySummary
                    averages={plan.weekly_averages}
                    targets={plan.targets}
                    chatId={chatid}
                    planId={plan.id}
                    onFixComplete={handleFixComplete}
                  />
                  {chatid && idToken && (
                    <CuisineSettings
                      chatId={chatid}
                      token={idToken}
                      onPreferencesChanged={() => setPlanStale(true, [])}
                    />
                  )}
                  {chatid && idToken && (
                    <Recommendations
                      chatId={chatid}
                      token={idToken}
                      selectedDay={selectedDay}
                      onAccept={(updatedPlan) => setPlan(updatedPlan)}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-3.5 rounded-full shadow-lg hover:bg-primary/90 transition-colors z-50"
        aria-label="Chat with AI"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
            <SheetTitle className="text-base">Chat with Barbie</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatWindow chatId={chatid} contextPrompt={contextPrompt} className="h-full" />
          </div>
        </SheetContent>
      </Sheet>

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

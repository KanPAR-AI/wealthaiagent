import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { smartSwapMeal, uploadFile } from "@/services/meal-plan-service";
import type {
  MealPlanMeal,
  SmartSwapResponse,
  SwapChangeSummary,
} from "@/types/meal-plan";

type SwapStep = "choose" | "custom-input" | "processing" | "summary";

const MEAL_TYPE_LABELS: Record<string, string> = {
  early_morning: "Early Morning",
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

interface SwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealPlanMeal;
  dayIndex: number;
  mealIndex: number;
  dayName: string;
  planId: string;
  chatId: string;
  onSwapComplete: (response: SmartSwapResponse) => void;
}

export function SwapDialog({
  open,
  onOpenChange,
  meal,
  dayIndex,
  mealIndex,
  dayName,
  planId,
  chatId,
  onSwapComplete,
}: SwapDialogProps) {
  const { idToken } = useAuth();
  const [step, setStep] = useState<SwapStep>("choose");
  const [foodText, setFoodText] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [changeSummary, setChangeSummary] = useState<SwapChangeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mealLabel = MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type;

  const resetState = () => {
    setStep("choose");
    setFoodText("");
    setFileUrl(null);
    setFileName("");
    setError(null);
    setChangeSummary(null);
    setProcessingMsg("");
    setIsUploading(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  // --- Auto swap ---
  const handleAutoSwap = async () => {
    setStep("processing");
    setProcessingMsg("Finding a healthy alternative...");
    await executeSwap("auto");
  };

  // --- File upload ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !idToken) return;

    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadFile(idToken, file);
      setFileUrl(result.url);
      setFileName(file.name);
    } catch {
      setError("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  // --- Custom submit ---
  const handleCustomSubmit = async () => {
    if (!foodText && !fileUrl) return;
    setStep("processing");
    setProcessingMsg(fileUrl ? "Analyzing food image..." : "Analyzing your meal...");
    await executeSwap("custom", foodText || undefined, fileUrl || undefined);
  };

  // --- Core swap ---
  const executeSwap = async (
    mode: "auto" | "custom",
    text?: string,
    url?: string
  ) => {
    if (!idToken) return;
    try {
      const response = await smartSwapMeal(idToken, chatId, {
        plan_id: planId,
        day_index: dayIndex,
        meal_index: mealIndex,
        mode,
        ...(text && { food_text: text }),
        ...(url && { file_url: url }),
      });
      setChangeSummary(response.changes);
      setStep("summary");
      onSwapComplete(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
      setStep("choose");
    }
  };

  const formatDelta = (val: number, unit: string) => {
    if (val === 0) return null;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}${unit}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md mx-4 rounded-2xl p-0 overflow-hidden gap-0">
        {/* --- Step: Choose --- */}
        {step === "choose" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-lg">
                Swap {mealLabel}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {dayName} &middot; {meal.name} &middot; {meal.total_calories} cal
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mx-6 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="px-6 pb-6 pt-3 space-y-3">
              <button
                onClick={handleAutoSwap}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Find Alternative
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    AI suggests a healthy swap that fits your plan
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setStep("custom-input"); setError(null); }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    I'll choose my meal
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Enter what you ate or snap a photo
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* --- Step: Custom Input --- */}
        {step === "custom-input" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-lg">What did you eat?</DialogTitle>
              <DialogDescription>
                Replacing {mealLabel} on {dayName}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mx-6 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="px-6 pb-6 pt-3 space-y-4">
              <textarea
                value={foodText}
                onChange={(e) => setFoodText(e.target.value)}
                placeholder="e.g., pizza and a coke, or 2 parathas with curd..."
                className="w-full h-24 rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
                autoFocus
              />

              {/* Image upload */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-accent/30 transition-all text-sm text-muted-foreground disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  )}
                  {isUploading ? "Uploading..." : "Upload photo"}
                </button>

                {fileName && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <span className="truncate max-w-[140px]">{fileName}</span>
                    <button
                      onClick={() => { setFileUrl(null); setFileName(""); }}
                      className="ml-1 hover:text-destructive"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("choose"); setError(null); }}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!foodText && !fileUrl}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
                >
                  Swap Meal
                </button>
              </div>
            </div>
          </>
        )}

        {/* --- Step: Processing --- */}
        {step === "processing" && (
          <div className="px-6 py-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
            </div>
            <p className="text-sm font-medium text-foreground">{processingMsg}</p>
            <p className="text-xs text-muted-foreground">
              This may take a few seconds...
            </p>
          </div>
        )}

        {/* --- Step: Summary --- */}
        {step === "summary" && changeSummary && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                Swap Complete
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 pt-2 space-y-4">
              {/* Swapped meal card */}
              <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4">
                <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
                  {changeSummary.swapped_meal.day_name} &middot; {MEAL_TYPE_LABELS[changeSummary.swapped_meal.meal_type] || changeSummary.swapped_meal.meal_type}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground line-through">
                    {changeSummary.swapped_meal.original_name}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  <span className="font-semibold text-foreground">
                    {changeSummary.swapped_meal.new_name}
                  </span>
                </div>
                <div className="flex gap-3 mt-2 text-xs">
                  {[
                    formatDelta(changeSummary.swapped_meal.delta.calories, " cal"),
                    formatDelta(changeSummary.swapped_meal.delta.protein_g, "g protein"),
                  ]
                    .filter(Boolean)
                    .map((d, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          d!.startsWith("+")
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                </div>
              </div>

              {/* Compensation info */}
              {changeSummary.compensations.length > 0 && (
                <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2.5">
                  <p className="text-sm font-medium text-foreground">
                    Menu Adjusted
                  </p>
                  {changeSummary.compensations.map((comp, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">
                        {comp.day_name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-muted-foreground line-through text-xs">
                          {comp.original_meal_name}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        <span className="font-medium text-foreground text-xs">
                          {comp.new_meal_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {comp.original_calories} → {comp.new_calories} cal
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Updated weekly avg */}
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">Weekly Avg</span>
                <span className="font-semibold">
                  {changeSummary.updated_weekly_averages.calories} / {changeSummary.targets.calories} kcal
                </span>
              </div>

              <button
                onClick={() => handleOpenChange(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
              >
                Done
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

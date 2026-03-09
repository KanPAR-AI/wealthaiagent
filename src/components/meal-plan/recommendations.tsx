'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import {
  getRecommendations,
  acceptRecommendation,
  type MealRecommendation,
} from '@/services/meal-plan-service';
import type { StructuredMealPlan } from '@/types/meal-plan';

interface RecommendationsProps {
  chatId: string;
  token: string;
  selectedDay: number;
  onAccept: (plan: StructuredMealPlan) => void;
}

export function Recommendations({
  chatId,
  token,
  selectedDay,
  onAccept,
}: RecommendationsProps) {
  const [recs, setRecs] = useState<MealRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !token) return;
    setLoading(true);
    getRecommendations(token, chatId)
      .then((res) => setRecs(res.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [chatId, token]);

  const handleAccept = useCallback(
    async (rec: MealRecommendation, mealIndex: number) => {
      setAccepting(rec.template_id);
      try {
        const result = await acceptRecommendation(
          token,
          chatId,
          rec.template_id,
          selectedDay,
          mealIndex
        );
        onAccept(result.plan);
        setDismissed((prev) => new Set([...prev, rec.template_id]));
      } catch {
        // silently fail
      } finally {
        setAccepting(null);
      }
    },
    [token, chatId, selectedDay, onAccept]
  );

  const handleDismiss = (templateId: string) => {
    setDismissed((prev) => new Set([...prev, templateId]));
  };

  const visible = recs.filter((r) => !dismissed.has(r.template_id));

  if (loading || visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-yellow-500" />
        You might also like
      </div>
      <div className="space-y-1.5">
        {visible.slice(0, 3).map((rec) => (
          <div
            key={rec.template_id}
            className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium">{rec.name}</span>
              <span className="text-muted-foreground ml-1.5">
                {rec.calories} kcal
              </span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleAccept(rec, 0)}
                disabled={accepting === rec.template_id}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[11px]"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
              <button
                onClick={() => handleDismiss(rec.template_id)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{visible[0]?.reason}</p>
    </div>
  );
}

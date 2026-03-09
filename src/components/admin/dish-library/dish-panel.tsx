'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import {
  generateDishBatch,
  fetchPendingDishes,
  approveDishes,
  rejectDishes,
  type PendingDish,
} from '@/services/admin-service';

const CUISINE_OPTIONS = [
  { id: 'north_indian', label: 'North Indian' },
  { id: 'south_indian', label: 'South Indian' },
  { id: 'maharashtrian', label: 'Maharashtrian' },
  { id: 'bengali', label: 'Bengali' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'rajasthani', label: 'Rajasthani' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'kerala', label: 'Keralite' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'andhra', label: 'Andhra/Telangana' },
  { id: 'goan', label: 'Goan' },
  { id: 'kashmiri', label: 'Kashmiri' },
  { id: 'odia', label: 'Odia' },
  { id: 'bihari', label: 'Bihari' },
  { id: 'assamese', label: 'Assamese' },
  { id: 'himachali', label: 'Himachali' },
  { id: 'italian', label: 'Italian' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'thai', label: 'Thai' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'continental', label: 'Continental' },
  { id: 'french', label: 'French' },
  { id: 'korean', label: 'Korean' },
  { id: 'middle_eastern', label: 'Middle Eastern' },
  { id: 'vietnamese', label: 'Vietnamese' },
  { id: 'american', label: 'American' },
  { id: 'turkish', label: 'Turkish' },
];

interface DishPanelProps {
  agentId: string;
}

export function DishPanel({ agentId }: DishPanelProps) {
  const [cuisine, setCuisine] = useState('');
  const [count, setCount] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [dishes, setDishes] = useState<PendingDish[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!cuisine) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateDishBatch(agentId, cuisine, count);
      setResult(
        `Generated ${res.dishes_generated} dishes, ${res.templates_generated} templates. ` +
        (res.duplicates_skipped?.length
          ? `Skipped ${res.duplicates_skipped.length} duplicates.`
          : '')
      );
      // Reload pending
      const pending = await fetchPendingDishes(agentId, cuisine);
      setDishes(pending.dishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [agentId, cuisine, count]);

  const handleLoadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchPendingDishes(agentId, cuisine || undefined);
      setDishes(pending.dishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [agentId, cuisine]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(dishes.map((d) => d.food_id)));
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await approveDishes(agentId, Array.from(selected));
      setResult(`Approved ${selected.size} dishes`);
      setSelected(new Set());
      const pending = await fetchPendingDishes(agentId, cuisine || undefined);
      setDishes(pending.dishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await rejectDishes(agentId, Array.from(selected));
      setResult(`Rejected ${selected.size} dishes`);
      setSelected(new Set());
      const pending = await fetchPendingDishes(agentId, cuisine || undefined);
      setDishes(pending.dishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate section */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Generate New Dishes</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Cuisine</label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full text-sm px-3 py-1.5 rounded border border-border bg-background"
            >
              <option value="">Select cuisine...</option>
              {CUISINE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="text-xs text-muted-foreground block mb-1">Count</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 25)))}
              className="w-full text-sm px-3 py-1.5 rounded border border-border bg-background"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!cuisine || generating}
            className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
          </button>
          <button
            onClick={handleLoadPending}
            disabled={loading}
            className="px-4 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            Load Pending
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</div>
      )}
      {result && (
        <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-3 py-2">{result}</div>
      )}

      {/* Pending dishes table */}
      {dishes.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-sm font-medium">{dishes.length} pending dishes</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground">
                Select All
              </button>
              <button
                onClick={handleApprove}
                disabled={selected.size === 0 || loading}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-3 w-3" /> Approve ({selected.size})
              </button>
              <button
                onClick={handleReject}
                disabled={selected.size === 0 || loading}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Reject ({selected.size})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Cal</th>
                  <th className="px-3 py-2 text-right">P</th>
                  <th className="px-3 py-2 text-right">C</th>
                  <th className="px-3 py-2 text-right">F</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr
                    key={dish.food_id}
                    className={`border-b border-border/50 hover:bg-muted/30 ${
                      selected.has(dish.food_id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(dish.food_id)}
                        onChange={() => toggleSelect(dish.food_id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{dish.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{dish.calories_per_100g}</td>
                    <td className="px-3 py-2 text-right font-mono">{dish.protein_g}</td>
                    <td className="px-3 py-2 text-right font-mono">{dish.carbs_g}</td>
                    <td className="px-3 py-2 text-right font-mono">{dish.fat_g}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        dish.source === 'usda'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {dish.source}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {dish.warnings?.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          {dish.warnings.length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

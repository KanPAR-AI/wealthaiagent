'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { updateCuisinePreferences } from '@/services/meal-plan-service';
import type { CuisinePreferences } from '@/types/meal-plan';

const CUISINE_OPTIONS = [
  { id: 'north_indian', label: 'North Indian', group: 'Indian' },
  { id: 'south_indian', label: 'South Indian', group: 'Indian' },
  { id: 'maharashtrian', label: 'Maharashtrian', group: 'Indian' },
  { id: 'bengali', label: 'Bengali', group: 'Indian' },
  { id: 'gujarati', label: 'Gujarati', group: 'Indian' },
  { id: 'rajasthani', label: 'Rajasthani', group: 'Indian' },
  { id: 'punjabi', label: 'Punjabi', group: 'Indian' },
  { id: 'kerala', label: 'Keralite', group: 'Indian' },
  { id: 'tamil', label: 'Tamil', group: 'Indian' },
  { id: 'andhra', label: 'Andhra/Telangana', group: 'Indian' },
  { id: 'goan', label: 'Goan', group: 'Indian' },
  { id: 'kashmiri', label: 'Kashmiri', group: 'Indian' },
  { id: 'italian', label: 'Italian', group: 'International' },
  { id: 'chinese', label: 'Chinese', group: 'International' },
  { id: 'thai', label: 'Thai', group: 'International' },
  { id: 'japanese', label: 'Japanese', group: 'International' },
  { id: 'mexican', label: 'Mexican', group: 'International' },
  { id: 'mediterranean', label: 'Mediterranean', group: 'International' },
  { id: 'continental', label: 'Continental', group: 'International' },
  { id: 'korean', label: 'Korean', group: 'International' },
] as const;

interface CuisineSettingsProps {
  chatId: string;
  token: string;
  currentPreferences?: CuisinePreferences;
  onPreferencesChanged: () => void;
}

export function CuisineSettings({
  chatId,
  token,
  currentPreferences,
  onPreferencesChanged,
}: CuisineSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefs, setPrefs] = useState<CuisinePreferences>(currentPreferences ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toggleCuisine = useCallback((id: string) => {
    setPrefs((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = 5;
      }
      return next;
    });
    setDirty(true);
  }, []);

  const setRating = useCallback((id: string, value: number) => {
    setPrefs((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, value)) }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCuisinePreferences(token, chatId, prefs);
      setDirty(false);
      onPreferencesChanged();
    } catch (err) {
      console.error('Failed to save cuisine preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const groups: Record<string, typeof CUISINE_OPTIONS[number][]> = {};
  for (const opt of CUISINE_OPTIONS) {
    if (!groups[opt.group]) groups[opt.group] = [];
    groups[opt.group].push(opt);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer"
      >
        <span>Cuisine Preferences</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {Object.entries(groups).map(([groupName, options]) => (
            <div key={groupName}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{groupName}</p>
              <div className="space-y-1">
                {options.map((opt) => {
                  const isActive = opt.id in prefs;
                  const rating = prefs[opt.id] ?? 0;
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                        isActive ? 'bg-primary/5' : ''
                      }`}
                    >
                      <button
                        onClick={() => toggleCuisine(opt.id)}
                        className="flex items-center gap-1.5 min-w-[100px] cursor-pointer"
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            isActive ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                          }`}
                        >
                          {isActive && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <span className={isActive ? 'font-medium' : 'text-muted-foreground'}>
                          {opt.label}
                        </span>
                      </button>
                      {isActive && (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={rating}
                            onChange={(e) => setRating(opt.id, parseInt(e.target.value))}
                            className="flex-1 h-1 accent-primary cursor-pointer"
                          />
                          <span className="font-mono text-primary w-5 text-right">{rating}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Regenerate Plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

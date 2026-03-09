'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface CuisineOption {
  id: string;
  label: string;
  group: string;
}

interface CuisineProportionWidgetProps {
  id: string;
  title?: string;
  isHistory?: boolean;
  data: {
    options: CuisineOption[];
    min_select?: number;
    max_select?: number;
    min_rating?: number;
    max_rating?: number;
    default_rating?: number;
    submit_label?: string;
    message_prefix?: string;
  };
}

export function CuisineProportionWidget({ data, isHistory }: CuisineProportionWidgetProps) {
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  const minSelect = data.min_select ?? 1;
  const maxRating = data.max_rating ?? 10;
  const minRating = data.min_rating ?? 1;
  const defaultRating = data.default_rating ?? 5;
  const messagePrefix = data.message_prefix ?? '';

  // Group options by group
  const grouped = useMemo(() => {
    const groups: Record<string, CuisineOption[]> = {};
    for (const opt of data.options) {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    }
    return groups;
  }, [data.options]);

  const toggleCuisine = (id: string) => {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, defaultRating);
      }
      return next;
    });
  };

  const setRating = (id: string, rating: number) => {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(id, Math.max(minRating, Math.min(maxRating, rating)));
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted || selected.size < minSelect) return;
    setSubmitted(true);
    const parts = data.options
      .filter((o) => selected.has(o.id))
      .map((o) => `${o.label} ${selected.get(o.id)}`);
    window.dispatchEvent(
      new CustomEvent('chat-quick-reply', {
        detail: { text: `${messagePrefix}${parts.join(', ')}` },
      })
    );
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex gap-2"
      >
        <span className="text-xs text-muted-foreground">
          Set {selected.size} cuisine preference{selected.size !== 1 ? 's' : ''}
        </span>
      </motion.div>
    );
  }

  if (isHistory) {
    return (
      <div className="mt-2 opacity-40 pointer-events-none">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.options.map((option) => (
            <span
              key={option.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-sm"
            >
              <span className="truncate">{option.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {Object.entries(grouped).map(([groupName, options]) => (
        <div key={groupName}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {groupName}
          </h4>
          <div className="space-y-1.5">
            {options.map((option) => {
              const isActive = selected.has(option.id);
              const rating = selected.get(option.id) ?? 0;
              return (
                <div
                  key={option.id}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg border text-sm
                    transition-all duration-150
                    ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-primary/30'
                    }
                  `}
                >
                  <button
                    onClick={() => toggleCuisine(option.id)}
                    className="flex items-center gap-2 min-w-[120px] cursor-pointer"
                  >
                    <div
                      className={`
                        w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                        ${isActive ? 'bg-primary border-primary' : 'border-muted-foreground/40'}
                      `}
                    >
                      {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className={`truncate ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {option.label}
                    </span>
                  </button>
                  {isActive && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="range"
                        min={minRating}
                        max={maxRating}
                        value={rating}
                        onChange={(e) => setRating(option.id, parseInt(e.target.value))}
                        className="flex-1 h-1.5 accent-primary cursor-pointer"
                      />
                      <span className="text-xs font-mono text-primary w-6 text-right">
                        {rating}/{maxRating}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={selected.size < minSelect}
        className={`
          w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-150
          ${
            selected.size >= minSelect
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }
        `}
      >
        {data.submit_label ?? 'Continue'}{' '}
        {selected.size > 0 && `(${selected.size} selected)`}
      </button>
    </div>
  );
}

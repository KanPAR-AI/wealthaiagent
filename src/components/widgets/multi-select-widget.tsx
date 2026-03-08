'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface MultiSelectOption {
  id: string;
  label: string;
  emoji?: string;
}

interface MultiSelectWidgetProps {
  id: string;
  title?: string;
  isHistory?: boolean;
  data: {
    options: MultiSelectOption[];
    min_select?: number;
    max_select?: number;
    submit_label?: string;
    message_prefix?: string;
  };
}

export function MultiSelectWidget({ data, isHistory }: MultiSelectWidgetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const minSelect = data.min_select ?? 1;
  const maxSelect = data.max_select ?? data.options.length;
  const messagePrefix = data.message_prefix ?? '';

  const toggle = (id: string) => {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelect) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted || selected.size < minSelect) return;
    setSubmitted(true);
    const labels = data.options
      .filter((o) => selected.has(o.id))
      .map((o) => o.label)
      .join(', ');
    window.dispatchEvent(
      new CustomEvent('chat-quick-reply', {
        detail: { text: `${messagePrefix}${labels}` },
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
          Selected {selected.size} option{selected.size !== 1 ? 's' : ''}
        </span>
      </motion.div>
    );
  }

  // Historical widgets: render as disabled (already used)
  if (isHistory) {
    return (
      <div className="mt-2 opacity-40 pointer-events-none">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.options.map((option) => (
            <span
              key={option.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted text-muted-foreground text-sm font-medium"
            >
              {option.emoji && <span className="text-base">{option.emoji}</span>}
              <span className="truncate">{option.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.options.map((option) => {
          const isSelected = selected.has(option.id);
          return (
            <button
              key={option.id}
              onClick={() => toggle(option.id)}
              className={`
                relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium
                transition-all duration-150 cursor-pointer
                ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {option.emoji && <span className="text-base">{option.emoji}</span>}
              <span className="truncate">{option.label}</span>
              {isSelected && (
                <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
              )}
            </button>
          );
        })}
      </div>
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

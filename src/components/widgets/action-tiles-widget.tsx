'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface ActionItem {
  label: string;
  message: string;
}

interface ActionTilesWidgetProps {
  id: string;
  title?: string;
  isHistory?: boolean;
  data: {
    /** Legacy format */
    actions?: Array<{ label: string; message: string }>;
    /** Dietician format: tiles + message_prefix */
    tiles?: Array<{ id: string; label: string; icon?: string }>;
    message_prefix?: string;
  };
}

export function ActionTilesWidget({ data, isHistory, ...rest }: ActionTilesWidgetProps) {
  const [clicked, setClicked] = useState(false);

  // Resilient like mobile's widget-view: a payload with top-level actions
  // (no data nesting) must render, not crash — an undefined `data` here
  // white-screened entire chats (bug 6d2f70b0).
  const src: ActionTilesWidgetProps['data'] = data ?? (rest as any);

  // Normalize: support both {actions} and {tiles + message_prefix} formats
  const actions: ActionItem[] = useMemo(() => {
    if (src.actions?.length) return src.actions;
    if (src.tiles?.length) {
      const prefix = src.message_prefix ?? '';
      return src.tiles.map((t) => ({ label: t.label, message: `${prefix}${t.id}` }));
    }
    return [];
  }, [src]);

  const handleClick = (message: string) => {
    if (clicked) return;
    setClicked(true);
    window.dispatchEvent(
      new CustomEvent('chat-quick-reply', { detail: { text: message } })
    );
  };

  if (clicked) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex gap-2"
      >
        <span className="text-xs text-muted-foreground">Confirmed</span>
      </motion.div>
    );
  }

  // Historical widgets: render as disabled (already used)
  if (isHistory) {
    return (
      <div className="flex flex-wrap gap-2 mt-1 opacity-40 pointer-events-none">
        {actions.map((action, i) => (
          <span
            key={i}
            className="px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-medium"
          >
            {action.label}
          </span>
        ))}
      </div>
    );
  }

  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => handleClick(action.message)}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium
                     hover:bg-primary/90 active:scale-95 transition-all duration-150 cursor-pointer
                     shadow-sm hover:shadow-md"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface ActionTilesWidgetProps {
  id: string;
  title?: string;
  data: {
    actions: Array<{ label: string; message: string }>;
  };
}

export function ActionTilesWidget({ data }: ActionTilesWidgetProps) {
  const [clicked, setClicked] = useState(false);

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

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {data.actions.map((action, i) => (
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

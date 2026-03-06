import { useState } from "react";
import type { MealRatingValue } from "@/types/meal-plan";

const RATING_EMOJIS: { value: MealRatingValue; emoji: string; label: string }[] = [
  { value: 1, emoji: "\uD83E\uDD22", label: "Hate" },
  { value: 2, emoji: "\uD83D\uDE15", label: "Meh" },
  { value: 3, emoji: "\uD83D\uDE10", label: "Neutral" },
  { value: 4, emoji: "\uD83D\uDE0A", label: "Like" },
  { value: 5, emoji: "\uD83D\uDE0D", label: "Love" },
];

interface MealRatingProps {
  /** Current rating (undefined = unrated, defaults to neutral display) */
  rating?: MealRatingValue;
  /** Called when user taps an emoji */
  onRate: (value: MealRatingValue) => void;
  /** Disable interaction (e.g., while saving) */
  disabled?: boolean;
}

export function MealRating({ rating, onRate, disabled = false }: MealRatingProps) {
  const [hoveredValue, setHoveredValue] = useState<MealRatingValue | null>(null);

  return (
    <div className="flex items-center gap-1 pt-2">
      {RATING_EMOJIS.map(({ value, emoji, label }) => {
        const isActive = rating === value;
        const isHovered = hoveredValue === value;

        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onRate(value)}
            onMouseEnter={() => setHoveredValue(value)}
            onMouseLeave={() => setHoveredValue(null)}
            title={label}
            className={`
              text-lg leading-none rounded-md p-1 transition-all
              ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
              ${isActive
                ? "bg-primary/10 ring-1 ring-primary/30 scale-110"
                : rating
                  ? "opacity-40 hover:opacity-80 hover:scale-105"
                  : "opacity-30 hover:opacity-80 hover:scale-105"
              }
              ${isHovered && !isActive ? "opacity-80 scale-105" : ""}
            `}
          >
            {emoji}
          </button>
        );
      })}
      {rating === 1 && (
        <span className="text-[10px] text-destructive/70 ml-1 font-medium">
          Excluded
        </span>
      )}
    </div>
  );
}

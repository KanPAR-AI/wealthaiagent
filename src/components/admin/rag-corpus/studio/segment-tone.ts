// Lane colours for segment types, in one place.
//
// Shared because the timeline, the scrub bar and the segments table all draw
// the same five types, and three components each keeping their own map is how
// a warning ends up amber on one screen and red on another. Which colour is
// wrong matters less than the two of them disagreeing.
//
// Warning is red on purpose: it is the one type a consumer must never silently
// drop, so it should be findable at a glance rather than tasteful.

export const TYPE_TONE: Record<string, string> = {
  exercise: "bg-emerald-500",
  instruction: "bg-sky-500",
  tip: "bg-amber-400",
  warning: "bg-rose-500",
  equipment: "bg-violet-500",
  other: "bg-muted-foreground/40",
};

export function toneOf(type: string | null | undefined): string {
  return TYPE_TONE[String(type || "other")] ?? TYPE_TONE.other;
}

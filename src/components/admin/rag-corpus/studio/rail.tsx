// The left rail (docs/25, present on every screen of the mockup).
//
// It exists to answer "what else is here?", which the old single-tab Corpus
// page could not: every surface was stacked into one scrolling column, so the
// only way to learn the platform had templates was to be told.
//
// SECTIONS THAT DO NOT EXIST ARE STILL LISTED
//
// Analytics and Playground are rendered, disabled, with the reason they are not
// built. Hiding them would be tidier and would misrepresent the product: a
// section that quietly is not there reads as one nobody planned, where a
// section saying what it needs is a roadmap somebody can argue with. The same
// call the asset tabs make.

import { BarChart3, FlaskConical, Library, LayoutTemplate } from "lucide-react";

export type RailSection = "corpora" | "templates" | "analytics" | "playground";

interface Item {
  key: RailSection;
  label: string;
  icon: typeof Library;
  built: boolean;
  /** Shown on hover and in the panel. Only meaningful when `built` is false. */
  why?: string;
}

export const RAIL_ITEMS: Item[] = [
  { key: "corpora", label: "Corpora", icon: Library, built: true },
  { key: "templates", label: "Templates", icon: LayoutTemplate, built: true },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    built: false,
    why:
      "Nothing records what agents actually retrieve. Usage analytics needs " +
      "retrieval hits logged per corpus and per segment — the retrieval path " +
      "returns matches today and writes down nothing about them, so there is " +
      "no data to chart yet.",
  },
  {
    key: "playground",
    label: "Playground",
    icon: FlaskConical,
    built: false,
    why:
      "Asking a corpus a question and seeing the answer with citations needs " +
      "an answer to show. Retrieval returns ranked segments; nothing " +
      "synthesises prose from them, so a playground today would print a list " +
      "of chunks and call it a reply.",
  },
];

export function StudioRail({
  active,
  onSelect,
  counts,
}: {
  active: RailSection;
  onSelect: (section: RailSection) => void;
  counts?: Partial<Record<RailSection, number>>;
}) {
  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border pb-2 md:w-44 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:pb-0 md:pr-3">
      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => item.built && onSelect(item.key)}
            disabled={!item.built}
            title={item.why}
            className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
              isActive
                ? "bg-muted font-medium text-foreground"
                : item.built
                  ? "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  : "cursor-not-allowed text-muted-foreground/50"
            }`}
          >
            <Icon size={14} className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {counts?.[item.key] != null && (
              <span className="rounded-full bg-background px-1.5 text-[10px] tabular-nums">
                {counts[item.key]}
              </span>
            )}
            {!item.built && <span className="text-[9px] opacity-70">soon</span>}
          </button>
        );
      })}
    </nav>
  );
}

/** What a not-yet-built section shows instead of a blank panel. */
export function NotBuilt({ section }: { section: RailSection }) {
  const item = RAIL_ITEMS.find((i) => i.key === section);
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6">
      <p className="text-sm font-medium">{item?.label} is not built yet</p>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
        {item?.why}
      </p>
    </div>
  );
}

// components/memory/filter-button.tsx — FilterButton (§3). The full filter
// rail (source/confidence/authority/dates/entity/used-by/used-in-run) is
// MemoryFilters, UI-1 scope. This button is present (so the header matches
// §3) but honestly says so instead of opening an empty/fake panel.
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function FilterButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="More filters"
      onClick={() => toast.info("More filters land with the Memories browser (UI-1).")}
    >
      <SlidersHorizontal className="size-4" />
    </Button>
  );
}

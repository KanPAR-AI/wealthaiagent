// components/memory/filter-button.tsx — FilterButton (§3). The full filter
// rail (type/domain/source/status/confidence/authority/dates/entity) is
// MemoryFilters (UI-1), which lives on the Memories screen — this header
// button, reachable from every Memory screen, navigates there rather than
// duplicating the rail or opening a fake panel. `used_by`/`used_in_run`
// are DEFERRED to UI-6 (need the usage projection).
import { useLocation, useNavigate } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function FilterButton() {
  const navigate = useNavigate();
  const location = useLocation();

  function onClick() {
    if (location.pathname === "/memory/memories") {
      toast.info("Filters are in the left rail on this screen.");
      return;
    }
    navigate(`/memory/memories${location.search}`);
  }

  return (
    <Button variant="outline" size="icon" aria-label="More filters" onClick={onClick}>
      <SlidersHorizontal className="size-4" />
    </Button>
  );
}

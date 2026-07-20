import { useEffect, useState } from "react";
import { ArrowLeft, AlertCircle, MessageSquare, Settings, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/store/admin";
import { getNewBugCount } from "@/services/bug-report-service";

export function AdminHeader() {
  const { selectedAgentId, setShowCreateWizard } = useAdminStore();

  // Poll the un-triaged bug-report count so admins see a live badge.
  // 60s cadence is plenty — this isn't a paging system.
  const [newBugCount, setNewBugCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const { new: n } = await getNewBugCount();
        if (!cancelled) setNewBugCount(n);
      } catch {
        // Best-effort — no error UI in the header.
      }
    };
    void fetchCount();
    const t = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-4">
          <Link
            to="/new"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-muted-foreground" />
            <h1 className="text-sm font-semibold">Admin Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/bugs">
            <Button size="sm" variant="ghost" className="relative">
              <AlertCircle size={14} className="mr-1" />
              Bug reports
              {newBugCount !== null && newBugCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold">
                  {newBugCount > 99 ? "99+" : newBugCount}
                </span>
              )}
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateWizard(true)}
          >
            <Plus size={14} className="mr-1" />
            Create Agent
          </Button>
          {selectedAgentId && (
            <Link to={`/admin/test/${selectedAgentId}`}>
              <Button size="sm" variant="outline">
                <MessageSquare size={14} className="mr-1" />
                Test Chat
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

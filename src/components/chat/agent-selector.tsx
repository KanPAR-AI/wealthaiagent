import { useState, useEffect, useRef } from "react";
import { Bot, ChevronDown, Sparkles, X } from "lucide-react";
import { getApiUrl } from "@/config/environment";
import { useAuthStore } from "@/store/auth";

interface AgentOption {
  id: string;
  name: string;
  description: string;
  is_dynamic: boolean;
  status?: string;
}

interface AgentSelectorProps {
  value: string | null;
  onChange: (agentId: string | null) => void;
  disabled?: boolean;
}

export function AgentSelector({ value, onChange, disabled }: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const token = useAuthStore((s) => s.idToken);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(getApiUrl("/agents/available"), { headers })
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {});
  }, [token]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = agents.find((a) => a.id === value);

  if (agents.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-flex">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
          transition-all duration-200 border
          ${
            value
              ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border-violet-300/50 dark:border-violet-700/50 text-violet-700 dark:text-violet-300 shadow-sm"
              : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted hover:border-border"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"}
        `}
      >
        {value ? (
          <Sparkles size={12} className="text-violet-500" />
        ) : (
          <Bot size={12} />
        )}
        <span className="max-w-[140px] truncate">
          {selected ? selected.name : "Smart Routing"}
        </span>
        <ChevronDown
          size={10}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        {value && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
            className="ml-0.5 p-0.5 rounded-full hover:bg-violet-500/20 transition-colors"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={`
            absolute bottom-full mb-2 left-0 z-50
            w-72 max-h-[320px] overflow-y-auto
            rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl
            shadow-2xl shadow-black/10
            animate-in fade-in slide-in-from-bottom-2 duration-200
          `}
        >
          {/* Auto option */}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`
              w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors
              ${!value ? "bg-primary/5" : "hover:bg-muted/50"}
            `}
          >
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                !value
                  ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                  : "bg-muted/50"
              }`}
            >
              <Sparkles
                size={12}
                className={!value ? "text-emerald-500" : "text-muted-foreground"}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-medium ${
                  !value ? "text-foreground" : "text-foreground/80"
                }`}
              >
                Smart Routing
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Auto-detect the best agent for your query
              </p>
            </div>
            {!value && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
          </button>

          <div className="h-px bg-border/50 mx-2" />

          {/* Agent options */}
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                onChange(agent.id);
                setOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors
                ${value === agent.id ? "bg-violet-500/5" : "hover:bg-muted/50"}
              `}
            >
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  value === agent.id
                    ? "bg-gradient-to-br from-violet-500/20 to-indigo-500/20"
                    : "bg-muted/50"
                }`}
              >
                <Bot
                  size={12}
                  className={
                    value === agent.id
                      ? "text-violet-500"
                      : "text-muted-foreground"
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-medium ${
                    value === agent.id ? "text-foreground" : "text-foreground/80"
                  }`}
                >
                  {agent.name}
                  {agent.is_dynamic && (
                    <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      agent.status === "draft"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {agent.status === "draft" ? "draft" : "custom"}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {agent.description}
                </p>
              </div>
              {value === agent.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

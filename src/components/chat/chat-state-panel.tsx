// "What I've learned (this chat)" — a collapsible debug/control panel pinned at
// the top of the chat. Shows the slots + belief + append-only event log the
// assistant is carrying for this conversation (chatservice /chats/{id}/state),
// and lets the user forget a single value or wipe the whole chat's state.
//
// Two jobs: (1) make conversation state legible so state bugs are diagnosable
// at a glance instead of by log-diving, and (2) give the user real control over
// what's remembered (privacy + a fast reset when state goes wrong).

import { useCallback, useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronRight, RotateCcw, Trash2 } from "lucide-react";

import {
  ChatState,
  StateEvent,
  UserMemory,
  fetchChatState,
  fetchUserMemory,
  forgetAllState,
  forgetSlot,
  setPersonalization,
} from "@/services/chat-state-service";

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 64 ? s.slice(0, 61) + "…" : s;
  }
  const s = String(v);
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
}

const KIND_STYLE: Record<string, string> = {
  asserted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  hypothetical: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  committed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  cleared: "bg-zinc-500/15 text-zinc-500",
};

// Map domain|slot → most-recent event kind so each live slot shows how it was set.
function latestKinds(events: StateEvent[]): Record<string, string> {
  const out: Record<string, string> = {};
  // events arrive newest-first; first seen wins.
  for (const e of events) {
    const k = `${e.domain}|${e.slot}`;
    if (!(k in out)) out[k] = e.kind;
  }
  return out;
}

function domainLabel(d: string): string {
  return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ageLabel(days?: number | null): string {
  if (days == null) return "";
  if (days >= 60) return `${Math.round(days / 30)}mo`;
  if (days >= 1) return `${days}d`;
  return "today";
}

// Flatten the user's cross-chat memory (all collections) into label/value rows.
function userFactsFlat(um: UserMemory | null): Array<{ label: string; value: string }> {
  if (!um) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const facts of Object.values(um.memory || {})) {
    for (const f of facts) {
      const label = String((f.key ?? f.category ?? "fact") as string);
      const raw = f.value;
      const value = raw == null ? "" : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      out.push({ label, value: value.length > 90 ? value.slice(0, 87) + "…" : value });
    }
  }
  return out;
}

interface Props {
  /** May be undefined on a brand-new chat — the panel still shows "About you". */
  chatId?: string;
  token: string | null;
  /** Bump to trigger a refetch (e.g. messages.length after each turn). */
  refreshSignal: number;
}

export function ChatStatePanel({ chatId, token, refreshSignal }: Props) {
  const [state, setState] = useState<ChatState | null>(null);
  const [userMem, setUserMem] = useState<UserMemory | null>(null);
  const [open, setOpen] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    // User-level memory isn't chat-scoped — load it even on a brand-new chat.
    fetchUserMemory(token).then(setUserMem).catch(() => {});
    if (!chatId) return;
    try {
      setState(await fetchChatState(chatId, token));
    } catch (e) {
      console.warn("[ChatStatePanel] load failed:", e);
    }
  }, [chatId, token]);

  const onTogglePersonalization = async (enabled: boolean) => {
    if (!token) return;
    setUserMem((m) => (m ? { ...m, personalization_enabled: enabled } : m)); // optimistic
    try {
      await setPersonalization(enabled, token);
    } catch {
      setUserMem((m) => (m ? { ...m, personalization_enabled: !enabled } : m));
    }
  };

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const onForgetSlot = async (domain: string, slot: string) => {
    if (!token || !chatId) return;
    setBusy(true);
    try {
      await forgetSlot(chatId, domain, slot, token);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onForgetAll = async () => {
    if (!token || !chatId) return;
    if (!window.confirm("Forget everything this chat has learned? This clears all saved values and their history for this conversation.")) return;
    setBusy(true);
    try {
      await forgetAllState(chatId, token);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const slotCount = state?.domains.reduce((n, d) => n + d.slots.length, 0) ?? 0;
  const hasBelief = Boolean(state?.belief && (state.belief as any).intent && (state.belief as any).intent !== "general");
  const aboutYou = userFactsFlat(userMem);
  const personalizationOff = userMem ? !userMem.personalization_enabled : false;

  // Show once we know the user's personalization state (userMem loaded) OR there
  // is chat state — so a fresh/empty chat still shows "About you" + the toggle.
  if (!userMem && slotCount === 0 && !hasBelief) return null;

  const kinds = latestKinds(state?.events ?? []);
  const summary =
    [slotCount ? `${slotCount} in chat` : "", aboutYou.length ? `${aboutYou.length} about you` : ""]
      .filter(Boolean)
      .join(" · ") || (personalizationOff ? "personalization off" : "nothing yet");

  return (
    <div className="border-b border-border/60 bg-muted/30 dark:bg-zinc-900/40 text-xs">
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 w-full py-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Brain className="h-3.5 w-3.5" />
          <span className="font-medium">What I've learned</span>
          <span className="text-muted-foreground/70">· {summary}</span>
        </button>

        {open && (
          <div className="pb-3 space-y-3">
            {/* Personalization toggle — controls whether the assistant uses any
                of your stored memory across chats. */}
            {userMem && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1">
                  <div className="text-foreground">Personalization</div>
                  <div className="text-[11px] text-muted-foreground/70">
                    {userMem.personalization_enabled
                      ? "Using what I know about you across chats"
                      : "Off — every chat starts fresh"}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={userMem.personalization_enabled}
                  onClick={() => onTogglePersonalization(!userMem.personalization_enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    userMem.personalization_enabled ? "bg-emerald-500" : "bg-zinc-400/50"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      userMem.personalization_enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Empty state so the expanded panel is never blank. */}
            {aboutYou.length === 0 && slotCount === 0 && !hasBelief && (
              <div className="italic text-muted-foreground/70">
                Nothing learned yet — as you chat, what I pick up about you appears here.
              </div>
            )}

            {/* About you — cross-chat learned facts (visible even on new chats). */}
            {aboutYou.length > 0 && (
              <div className="space-y-1">
                <div className="uppercase tracking-wide text-[10px] text-muted-foreground/70">About you</div>
                {aboutYou.map((f, i) => (
                  <div key={`u${i}`} className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-0 truncate">{f.label}</span>
                    <span className="font-mono text-foreground truncate">{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {(state?.domains ?? []).map((d) => (
              <div key={d.domain} className="space-y-1">
                <div className="uppercase tracking-wide text-[10px] text-muted-foreground/70">
                  {domainLabel(d.domain)}
                </div>
                {d.overlay && Object.keys(d.overlay).length > 0 && (
                  <div className="rounded px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">
                    ⚡ Active what-if{d.overlay_label ? ` (${d.overlay_label})` : ""}:{" "}
                    {Object.entries(d.overlay).map(([k, v]) => `${k} = ${fmtValue(v)}`).join(", ")}
                  </div>
                )}
                {d.slots.map((s) => {
                  const kind = kinds[`${d.domain}|${s.key}`] || "asserted";
                  return (
                    <div key={s.key} className="flex items-center gap-2 group">
                      <span className="text-muted-foreground min-w-0 truncate">{s.label}</span>
                      <span className="font-mono text-foreground truncate">{fmtValue(s.value)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${KIND_STYLE[kind] || KIND_STYLE.asserted}`}>
                        {kind}
                      </span>
                      {s.stale && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-600 dark:text-orange-400"
                          title={`Last confirmed ${ageLabel(s.age_days)} ago — may be worth re-checking`}
                        >
                          ⚠ {ageLabel(s.age_days)}
                        </span>
                      )}
                      <button
                        onClick={() => onForgetSlot(d.domain, s.key)}
                        disabled={busy}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity disabled:opacity-30"
                        aria-label={`Forget ${s.label}`}
                        title="Forget this value"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {(state?.events?.length ?? 0) > 0 && (
              <div>
                <button
                  onClick={() => setShowEvents((v) => !v)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 hover:text-foreground"
                >
                  {showEvents ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Event log ({state?.events.length ?? 0})
                </button>
                {showEvents && (
                  <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto font-mono text-[11px] text-muted-foreground">
                    {(state?.events ?? []).map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-muted-foreground/50">
                          {e.source_seq != null ? `#${e.source_seq}` : "·"}
                        </span>
                        <span className="truncate">
                          {e.slot} ← {fmtValue(e.value)}
                        </span>
                        <span className={`px-1 rounded text-[9px] uppercase ${KIND_STYLE[e.kind] || ""}`}>
                          {e.kind}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(slotCount > 0 || hasBelief) && chatId && (
              <button
                onClick={onForgetAll}
                disabled={busy}
                className="flex items-center gap-1.5 text-red-500/90 hover:text-red-500 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Forget this chat&apos;s info
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

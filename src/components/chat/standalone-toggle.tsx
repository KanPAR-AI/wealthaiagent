import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chat";

/**
 * Standalone chat — sealed off from user memory.
 *
 * Deliberately NOT called "temporary" or "incognito". The chat is saved,
 * appears in history and reopens months later; only the memory link is cut.
 * A name implying deletion would mislead someone into saying things they
 * otherwise would not, which is a worse failure than a plain name.
 *
 * The wording below is chosen to promise exactly what the backend enforces —
 * no more. "Won't use or update what we know about you" is true. "Private" or
 * "not saved" would not be.
 */

export function StandaloneToggle({ className = "" }: { className?: string }) {
  const standaloneMode = useChatStore((s) => s.standaloneMode);
  const setStandaloneMode = useChatStore((s) => s.setStandaloneMode);

  return (
    <button
      type="button"
      onClick={() => setStandaloneMode(!standaloneMode)}
      aria-pressed={standaloneMode}
      title={
        standaloneMode
          ? "Standalone chat: this conversation won't use or update what we know about you. It is still saved to your history."
          : "Start a standalone chat — it won't use or update what we know about you"
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        standaloneMode
          ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : "border-border text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      <ShieldOff size={13} aria-hidden />
      {standaloneMode ? "Standalone" : "Standalone chat"}
    </button>
  );
}

/**
 * Shown INSIDE a standalone chat, for as long as it is open.
 *
 * Load-bearing, because these chats DO appear in history: with a temporary or
 * incognito chat, the absence from the sidebar is itself the signal that
 * something is different. Here there is no such signal unless we draw one, and
 * a user who cannot tell which mode they are in cannot rely on either.
 */
export function StandaloneBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="This chat doesn't use or update what we know about you. It is still saved to your history."
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 ${className}`}
    >
      <ShieldOff size={11} aria-hidden />
      Standalone — not using or updating your memory
    </span>
  );
}

/**
 * The memory control in the chat top bar.
 *
 * Three states, because `standalone` is fixed when the chat is CREATED — the
 * API has no way to change it afterwards (PATCH /chats/{id} renames, nothing
 * more). So a plain on/off switch on an open conversation would be a lie: by
 * the time you flip it, earlier turns have already read your profile, and
 * nothing can retract that.
 *
 *   no chat open        → the real toggle; it arms the chat you are about to start
 *   standalone chat     → the badge; state is settled, nothing to decide
 *   ordinary chat open  → an honest ACTION, not a switch: start a new
 *                         standalone chat. It says what it will do.
 */
export function StandaloneHeaderControl({
  chatId,
  isStandalone,
  className = "",
}: {
  chatId?: string;
  isStandalone: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const setStandaloneMode = useChatStore((s) => s.setStandaloneMode);

  if (isStandalone) return <StandaloneBadge className={className} />;
  if (!chatId) return <StandaloneToggle className={className} />;

  return (
    <button
      type="button"
      onClick={() => {
        setStandaloneMode(true);
        navigate("/new");
      }}
      title="This chat already uses what we know about you, and that cannot be undone for messages already sent. This starts a NEW standalone chat instead."
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <ShieldOff size={13} aria-hidden />
      New standalone chat
    </button>
  );
}

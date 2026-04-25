import Sidebar from '@/components/chat/chat-sidebar';
import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import {
  applyMysticTheme,
  MYSTIC_AGENT,
  revertMysticTheme,
  useIsMysticAI,
} from '@/lib/mysticai';
import { CosmicBackground } from '@/components/mystic/cosmic-background';
import { useChatStore } from '@/store/chat';

function AppLayout() {
  const { chatid } = useParams<{ chatid?: string }>();
  // Reactive — re-renders when user toggles MysticAI from agent selector.
  const isMystic = useIsMysticAI();

  // Auto-toggle cosmic theme based on the currently-selected agent so that
  // ALL paths to MysticAI activate the cosmic UI: dropdown selection, chat
  // load (when an existing astrology_ai chat is opened), or page refresh.
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  useEffect(() => {
    if (selectedAgent === MYSTIC_AGENT) {
      applyMysticTheme();
    } else if (selectedAgent) {
      // Only revert when an explicit non-MysticAI agent is selected — leave
      // cosmic on if the user is on the astro subdomain (where the const
      // already activated it on page load).
      revertMysticTheme();
    }
  }, [selectedAgent]);

  return (
    <>
      {isMystic && <CosmicBackground />}
      <div
        className={`flex h-screen h-[100dvh] w-full overflow-hidden relative ${
          isMystic ? '' : 'bg-background'
        }`}
      >
        <Sidebar currentChatId={chatid} />
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          {/* The Outlet renders the active child route (Chat, New, etc.) */}
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default AppLayout;
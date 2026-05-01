import Sidebar from '@/components/chat/chat-sidebar';
import { useEffect, useState } from 'react';
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

  // iOS keyboard fix: lock the AppLayout container height to the visual
  // viewport. Without this, on iOS Safari/WKWebView (verified on iOS 26.2
  // Simulator) tapping the chat input pops up the keyboard, iOS scrolls
  // the document body to bring the input into view, and our top bar (in
  // normal flex flow) gets dragged out of the visible area. Even
  // overflow:hidden on the body and the meta interactive-widget hint
  // don't fully prevent it.
  //
  // Pinning the container to visualViewport.height makes the layout
  // exactly the size of the visible area between the address bar and
  // the keyboard, so iOS has nothing to scroll past — header stays put.
  // Falls back to 100dvh on browsers without visualViewport (none of the
  // current Tier-1 mobile browsers, but be safe).
  const [containerHeight, setContainerHeight] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const sync = () => setContainerHeight(`${vv.height}px`);
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  return (
    <>
      {isMystic && <CosmicBackground />}
      <div
        className={`flex h-screen h-[100dvh] w-full overflow-hidden relative ${
          isMystic ? '' : 'bg-background'
        }`}
        style={containerHeight ? { height: containerHeight } : undefined}
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
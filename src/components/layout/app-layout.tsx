import Sidebar from '@/components/chat/chat-sidebar';
import { Outlet, useParams } from 'react-router-dom';
import { isMysticAI } from '@/lib/mysticai';
import { CosmicBackground } from '@/components/mystic/cosmic-background';

function AppLayout() {
  const { chatid } = useParams<{ chatid?: string }>();

  return (
    <>
      {isMysticAI && <CosmicBackground />}
      <div
        className={`flex h-screen h-[100dvh] w-full overflow-hidden relative ${
          isMysticAI ? '' : 'bg-background'
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
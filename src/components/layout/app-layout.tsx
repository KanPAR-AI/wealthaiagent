import Sidebar from '@/components/chat/chat-sidebar';
import { Outlet, useParams } from 'react-router-dom';

function AppLayout() {
  const { chatid } = useParams<{ chatid?: string }>();

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background">
      <Sidebar currentChatId={chatid} />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* The Outlet renders the active child route (Chat, New, etc.) */}
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
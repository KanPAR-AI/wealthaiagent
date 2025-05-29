import Sidebar from '@/components/chat/chat-sidebar';
import { Outlet, useParams } from 'react-router-dom';

function AppLayout() {
  const { chatid } = useParams<{ chatid?: string }>();

  return (
    <div className="flex min-h-screen w-full overflow-hidden dark:bg-zinc-900">
      <Sidebar currentChatId={chatid} />
      <main className="flex-1 flex flex-col overflow-x-hidden relative">
        {/* The Outlet renders the active child route (Chat, New, etc.) */}
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
// src/pages/Chat.tsx
import { ChatHeader } from '@/components/chat/chat-header';
import ChatWindow from '@/components/chat/chat-window';
import { Navigate, useParams } from 'react-router-dom';

function Chat() {
  const { chatid } = useParams<{ chatid: string }>();
  
  if (!chatid) {
     console.error("Chat ID is missing in Chat page component.");
     return <Navigate to="/new" replace />;
  }
  
  return (
    <div className="flex h-full w-full overflow-hidden dark:bg-zinc-800">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        {/* sticky+top-0 keeps the chat header pinned even if iOS Safari/Chrome
            scrolls the body to bring the input into view when the on-screen
            keyboard pops up. Combined with the index.html viewport meta
            interactive-widget=resizes-content, the header should stay anchored
            in both modes. */}
        <div
          className="flex-shrink-0 sticky top-0 z-20 bg-background dark:bg-zinc-800 w-full"
          style={{
            // Directly apply safe-area padding so the header never hides under
            // the iOS status bar / Dynamic Island, even when parent containers
            // use overflow: hidden which can swallow #root padding.
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <ChatHeader />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden sm:p-0">
          <ChatWindow chatId={chatid} key={chatid} />
        </div>
      </main>
    </div>
  );
}

export default Chat;
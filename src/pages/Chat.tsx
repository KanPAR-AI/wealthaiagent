// src/pages/Chat.tsx
import { ChatHeader } from '@/components/chat/chat-header';
import ChatWindow from '@/components/chat/chat-window'; // Adjust path
import { Navigate, useParams } from 'react-router-dom';

function Chat() {
  const { chatid } = useParams<{ chatid: string }>();
  
  // Although routing should handle this, good practice to check
  if (!chatid) {
     console.error("Chat ID is missing in Chat page component.");
     return <Navigate to="/new" replace />;
  }
  
  return (
    // Main container: Full height, mobile-optimized
    <div className="flex h-screen w-full overflow-hidden dark:bg-zinc-900">
      {/* Main content area: Full width on mobile, flex column layout */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden w-full"> 
        {/* Fixed header */}
        <div className="flex-shrink-0 fixed sm:sticky z-10 bg-background dark:bg-zinc-900 border-b border-border w-full">
          <ChatHeader />
        </div>
        
        {/* Chat content area - takes remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden sm:p-0 ">
          <ChatWindow chatId={chatid} />
        </div>
      </main>
    </div>
  );
}

export default Chat;
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
    <div className="flex h-screen w-full overflow-hidden dark:bg-zinc-800">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden w-full"> 
        <div className="flex-shrink-0 fixed sm:sticky z-10 bg-background dark:bg-zinc-800 border-b border-border w-full">
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
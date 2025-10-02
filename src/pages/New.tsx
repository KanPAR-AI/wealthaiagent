// src/pages/New.tsx
import { ChatHeader } from '@/components/chat/chat-header';
import ChatWindow from '@/components/chat/chat-window';

function New() {
  return (
    <div className="flex h-screen w-full overflow-hidden dark:bg-zinc-800">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden w-full"> 
        <div className="flex-shrink-0 fixed sm:sticky z-10 bg-background dark:bg-zinc-800 border-b border-border w-full">
          <ChatHeader />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden sm:p-0">
          <ChatWindow />
        </div>
      </main>
    </div>
  );
}

export default New;
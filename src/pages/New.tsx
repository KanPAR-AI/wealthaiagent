// src/pages/New.tsx
import { ChatHeader } from '@/components/chat/chat-header';
import ChatWindow from '@/components/chat/chat-window'; // Adjust path

function New() {

  // This component now simply renders the ChatWindow in its "new chat" state
  // It doesn't have a chatId initially, letting ChatWindow handle the first message.
  // You might want a wrapper div for layout if needed, matching the <Chat /> page structure
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 dark:bg-zinc-900">


    {/* Main content area: Takes remaining width, contains ChatWindow */}
    <main className="flex-1 flex flex-col overflow-x-hidden"> {/* Ensure main area handles overflow */}
    <ChatHeader />
       <ChatWindow />
    </main>
  </div>
  );
}

export default New;
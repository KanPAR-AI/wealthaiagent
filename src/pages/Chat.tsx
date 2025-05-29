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
    // Main container: Full height, horizontal flex
    <div className="flex min-h-screen w-full overflow-hidden dark:bg-zinc-900 ">
      {/* Sidebar Component */}

      {/* Main content area: Takes remaining width, contains ChatWindow */}
      <main className="flex-1 flex flex-col overflow-x-hidden relative"> {/* Ensure main area handles overflow */}
      <ChatHeader />
         <ChatWindow chatId={chatid} />
      </main>
    </div>
  );
}

export default Chat;
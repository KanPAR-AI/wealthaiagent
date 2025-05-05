// src/pages/Chat.tsx
import { useParams, Navigate } from 'react-router-dom';
import ChatWindow from '@/components/molecules/chat-window'; // Adjust path
import Sidebar from '@/components/molecules/chat-sidebar';     // Adjust path
import { useAuth } from '@clerk/clerk-react';

function Chat() {
  const { chatid } = useParams<{ chatid: string }>();
  const { isLoaded } = useAuth();

  if (!isLoaded) {
     // Optional: Add a more visually appealing loading state
     return <div className="flex justify-center items-center h-screen">Loading Authentication...</div>;
  }

  // Although routing should handle this, good practice to check
  if (!chatid) {
     console.error("Chat ID is missing in Chat page component.");
     return <Navigate to="/new" replace />;
  }

  return (
    // Main container: Full height, horizontal flex
    <div className="flex min-h-screen w-full overflow-hidden dark:bg-zinc-900">
      {/* Sidebar Component */}
      <Sidebar currentChatId={chatid} />

      {/* Main content area: Takes remaining width, contains ChatWindow */}
      <main className="flex-1 flex flex-col overflow-x-hidden"> {/* Ensure main area handles overflow */}
         {/* Pass the chatId down as a prop. ChatWindow will manage its own internal layout */}
         <ChatWindow chatId={chatid} />
      </main>
    </div>
  );
}

export default Chat;
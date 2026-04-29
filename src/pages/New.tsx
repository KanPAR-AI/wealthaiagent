// src/pages/New.tsx
import { ChatHeader } from '@/components/chat/chat-header';
import ChatWindow from '@/components/chat/chat-window';

function New() {
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
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
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
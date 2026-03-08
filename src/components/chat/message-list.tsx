// components/chat/message-list.tsx

import { motion } from 'framer-motion';
import { ChatBubble } from './chat-bubbles'; // Assuming chat-bubbles.tsx contains ChatBubble
import { UserInfo, Message, ActionIconDefinition, MessageFile } from '@/types';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: UserInfo;
  onFileClick: (file: MessageFile) => void;
  actionIcons: ActionIconDefinition[];
  addMessageId?: boolean; // Optional prop to add data-message-id for scrolling
}

export const ChatMessageList = ({
  messages,
  currentUser,
  onFileClick,
  actionIcons,
  addMessageId = false,
}: ChatMessageListProps) => {
  console.log('[ChatMessageList] Rendering with', messages.length, 'messages');
  console.log('[ChatMessageList] Messages:', messages.map(m => ({ id: m.id, sender: m.sender, hasContent: !!m.message })));
  
  return (
    <>
      {/* Map through each message and render a ChatBubble */}
      {messages.map((message, idx) => {
        // A bot message's widgets are "history" if there's a user message after it
        // (meaning the user already interacted with the widget)
        const isHistory = message.sender === 'bot' && !message.isStreaming &&
          messages.slice(idx + 1).some(m => m.sender === 'user');
        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            {...(addMessageId && message.sender === 'user' && {
              'data-message-id': message.id,
            })}
          >
            <ChatBubble
              message={message}
              currentUser={currentUser}
              botAvatarSrc="/logo.svg"
              onFileClick={onFileClick}
              actionIcons={actionIcons}
              isHistory={isHistory}
            />
          </motion.div>
        );
      })}
  </>
  );
};

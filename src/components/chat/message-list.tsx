// components/chat/message-list.tsx

import { motion } from 'framer-motion';
import { ChatBubble } from './chat-bubbles'; // Assuming chat-bubbles.tsx contains ChatBubble
import { UserInfo, Message, ActionIconDefinition, MessageFile } from '@/types/chat';

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
}: ChatMessageListProps) => (
  <>
    {/* Map through each message and render a ChatBubble */}
    {messages.map((message) => (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 8 }} // Initial animation state
        animate={{ opacity: 1, y: 0 }} // Animate to visible state
        transition={{ duration: 0.3 }} // Animation duration
        // Add data-message-id for user messages to facilitate scrolling
        {...(addMessageId && message.sender === 'user' && {
          'data-message-id': message.id,
        })}
      >
        <ChatBubble
          message={message}
          currentUser={currentUser}
          botAvatarSrc="/logo.svg" // Path to your bot's avatar
          onFileClick={onFileClick} // Pass the file click handler
          actionIcons={actionIcons} // Pass action icons for bot messages
        />
      </motion.div>
    ))}
  </>
);

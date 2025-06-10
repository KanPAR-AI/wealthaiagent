import { motion } from 'framer-motion';
import { ChatBubble } from './chat-bubbles';
import { UserInfo, Message, ActionIconDefinition } from '@/types/chat';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: UserInfo;
  onImageClick: (url: string) => void;
  actionIcons: ActionIconDefinition[];
  addMessageId?: boolean;
}

export const ChatMessageList = ({
  messages,
  currentUser,
  onImageClick,
  actionIcons,
  addMessageId = false,
}: ChatMessageListProps) => (
  <>
    {messages.map((message) => (
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
          onImageClick={onImageClick}
          actionIcons={actionIcons}
        />
      </motion.div>
    ))}
  </>
);

import { motion } from 'framer-motion';
import { ChatBubble } from './chat-bubbles';
import { UserInfo, Message, ActionIconDefinition, MessageFile } from '@/types/chat';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: UserInfo;
  onFileClick: (file: MessageFile) => void;
  actionIcons: ActionIconDefinition[];
  addMessageId?: boolean;
}

export const ChatMessageList = ({
  messages,
  currentUser,
  onFileClick,
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
          onFileClick={onFileClick}
          actionIcons={actionIcons}
        />
      </motion.div>
    ))}
  </>
);

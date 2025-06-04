import { ChatBubble } from './chat-bubbles';
import { UserInfo, Message, ActionIconDefinition } from '@/types/chat';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: UserInfo;
  onImageClick: (url: string) => void;
  actionIcons: ActionIconDefinition[];
}

export const ChatMessageList = ({ 
  messages,
  currentUser,
  onImageClick,
  actionIcons
}: ChatMessageListProps) => (
  <>
    {messages.map((message) => (
      <ChatBubble
        key={message.id}
        message={message}
        currentUser={currentUser}
        botAvatarSrc="/logo.svg"
        onImageClick={onImageClick}
        actionIcons={actionIcons}
      />
    ))}
  </>
);
import { ActionIconDefinition, Message, UserInfo } from '@/types/chat';
import { ChatBubble } from './chat-bubbles';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: UserInfo;
  onImageClick: (url: string) => void;
  actionIcons: ActionIconDefinition[];
  addMessageId?: boolean;
  lastMessageRef?: React.Ref<HTMLDivElement>;
}

export const ChatMessageList = ({
  messages,
  currentUser,
  onImageClick,
  actionIcons,
  addMessageId = false,
  lastMessageRef
}: ChatMessageListProps) => (
  <>
    {messages.map((message, index) => {
      const isLast = index === messages.length - 1;
      return (
        <div
          key={message.id}
          {...(addMessageId && { 'data-message-id': message.id })}
          ref={isLast ? lastMessageRef : undefined}
        >
          <ChatBubble
            message={message}
            currentUser={currentUser}
            botAvatarSrc="/logo.svg"
            onImageClick={onImageClick}
            actionIcons={actionIcons}
          />
        </div>
      );
    })}
  </>
);

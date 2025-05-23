import { ActionIconDefinition, Message, UserInfo } from '@/types/chat';
import { JSX, useEffect } from 'react';
import { ChatBubbleAvatar } from '../ui/chat-bubble';
import StructuredContentRenderer from '../ui/structured-content-renderer';
import { FileRenderer } from './file-renderer';

interface ChatBubbleProps {
  message: Message;
  currentUser: UserInfo | undefined;
  botAvatarSrc?: string;
  botAvatarFallback?: string;
  actionIcons: ActionIconDefinition[];
  onImageClick: (url: string) => void;
}

export function ChatBubble({
  message,
  currentUser,
  botAvatarSrc = "/logo.svg",
  botAvatarFallback = "AI",
  actionIcons,
  onImageClick,
}: ChatBubbleProps): JSX.Element {
  const isUser = message.sender === 'user';
  const avatarSrc = isUser ? currentUser?.imageUrl : botAvatarSrc;
  const avatarFallback = isUser
    ? currentUser?.firstName?.substring(0, 2)?.toUpperCase() || 'U'
    : botAvatarFallback;

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    message.files?.forEach(file => {
      if (file.url && file.url.startsWith('blob:')) {
        urlsToRevoke.push(file.url);
      }
    });

    return () => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
    };
  }, [message.files, message.id]);

  const hasContent = message.message || message.structuredContent;

  return (
    <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-start sm:justify-end' : 'justify-start'}`}>
      {!isUser && <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />}

      <div className={`flex flex-col ${isUser ? 'items-start sm:items-end' : 'items-start'} max-w-[85%] md:max-w-[80%] w-full`}>
        {/* Message Text Bubble */}
        {hasContent && (
          <div
            className={`px-3 py-2 md:px-4 md:py-2 rounded-2xl break-words text-sm md:text-base ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted dark:bg-zinc-700 dark:text-zinc-200'
            }`}
          >
            {message.isLoading ? (
              <span className="italic opacity-70">Loading...</span>
            ) : message.error ? (
              <span className="italic text-red-500">{message.error}</span>
            ) : (
              message.message || (message.files && message.files.length > 0 ? null : <span className="italic opacity-70">...</span>)
            )}
             {message.structuredContent && (
                <div className={message.message ? 'mt-2 pt-2 border-t border-border/50' : ''}>
                    <StructuredContentRenderer content={message.structuredContent} />
                </div>
            )}
          </div>
        )}

        {/* File Attachments - Rendered outside the main bubble */}
        {message.files && message.files.length > 0 && (
          <div className={`mt-2 w-full grid gap-2 ${message.files.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {message.files.map((file, index) => (
              <FileRenderer key={index} file={file} onImageClick={onImageClick} />
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {!isUser && !message.isLoading && !message.error && (
          <div className="flex gap-1 mt-2">
            {actionIcons.map(({ icon: Icon, type, action }) => (
              <button
                key={type}
                onClick={() => action(message.id)}
                title={type}
                className="p-1 hover:bg-secondary dark:hover:bg-zinc-600 rounded-md transition-colors text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isUser && <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />}
    </div>
  );
}
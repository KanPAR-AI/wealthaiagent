import { ActionIconDefinition, Message, UserInfo } from '@/types/chat';
import { JSX, useEffect, useState, useRef, useCallback } from 'react';
import { ChatBubbleAvatar } from '../ui/chat-bubble';
import StructuredContentRenderer from '../ui/structured-content-renderer';
import { FileRenderer } from './file-renderer';
import { motion } from 'framer-motion';

interface ChatBubbleProps {
  message: Message;
  currentUser: UserInfo | undefined;
  botAvatarSrc?: string;
  botAvatarFallback?: string;
  actionIcons: ActionIconDefinition[];
  onImageClick: (url: string) => void;
  streamingSpeed?: number; // Make streaming speed configurable
  enableStreaming?: boolean; // Allow disabling streaming
}

export function ChatBubble({
  message,
  currentUser,
  botAvatarSrc = "/logo.svg",
  botAvatarFallback = "AI",
  actionIcons,
  onImageClick,
  streamingSpeed = 15,
  enableStreaming = true,
}: ChatBubbleProps): JSX.Element {
  const isUser = message.sender === 'user';
  const avatarSrc = isUser ? currentUser?.imageUrl : botAvatarSrc;
  const avatarFallback = isUser
    ? currentUser?.firstName?.substring(0, 2)?.toUpperCase() || 'U'
    : botAvatarFallback;

  // For streaming text effect
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized cleanup function
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Enhanced streaming effect with better control
  useEffect(() => {
    if (!isUser && message.message && !message.error && !message.isLoading) {
      if (enableStreaming) {
        setIsStreaming(true);
        setDisplayedText('');
        let index = 0;
        
        intervalRef.current = setInterval(() => {
          setDisplayedText(message.message!.substring(0, index + 1));
          index++;
          
          if (index >= message.message!.length) {
            cleanup();
          }
        }, streamingSpeed);

        return cleanup;
      } else {
        setDisplayedText(message.message);
      }
    } else {
      setDisplayedText(message.message || '');
    }
  }, [message.message, message.id, isUser, message.error, message.isLoading, enableStreaming, streamingSpeed, cleanup]);

  // Clean up blob URLs with better dependency tracking
  useEffect(() => {
    const urlsToRevoke: string[] = [];
    message.files?.forEach(file => {
      if (file.url && file.url.startsWith('blob:')) {
        urlsToRevoke.push(file.url);
      }
    });

    return () => {
      urlsToRevoke.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to revoke blob URL:', url, error);
        }
      });
    };
  }, [message.files]);

  const hasContent = message.message || message.structuredContent;

  // Enhanced animation variants
  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1] // Custom easing
      }
    }
  };

  const fileVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        delay: 0.1 
      }
    }
  };

  return (
    <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-start sm:justify-end' : 'justify-start'}`}>
      {!isUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />
        </motion.div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-start sm:items-end' : 'items-start'} max-w-[85%] md:max-w-[80%] w-full`}>
        {/* Message Bubble */}
        {hasContent && (
          <motion.div
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            className={`message-bubble px-3 py-2 md:px-4 md:py-2 rounded-2xl break-words text-sm md:text-base relative ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted dark:bg-zinc-700 dark:text-zinc-200'
            }`}
          >
            {/* Loading state with better UX */}
            {message.isLoading ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="italic opacity-70 text-xs">Typing...</span>
              </div>
            ) : message.error ? (
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-xs">⚠</span>
                <span className="italic text-red-500">{message.error}</span>
              </div>
            ) : (
              <div className="message-content">
                <span>{displayedText}</span>
                {/* Streaming cursor */}
                {isStreaming && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-current ml-0.5"
                  />
                )}
              </div>
            )}

            {/* Structured content with conditional spacing */}
            {message.structuredContent && (
              <div className={`${message.message ? 'mt-3 pt-3 border-t border-border/30' : ''}`}>
                <StructuredContentRenderer content={message.structuredContent} />
              </div>
            )}
          </motion.div>
        )}

        {/* File Attachments with improved grid */}
        {message.files && message.files.length > 0 && (
          <motion.div
            variants={fileVariants}
            initial="hidden"
            animate="visible"
            className={`mt-2 w-full grid gap-2 ${
              message.files.length === 1 
                ? 'grid-cols-1' 
                : message.files.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {message.files.map((file, index) => (
              <motion.div
                key={`${message.id}-file-${index}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <FileRenderer file={file} onImageClick={onImageClick} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action Buttons with improved accessibility */}
        {!isUser && !message.isLoading && !message.error && actionIcons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.2 }}
            className="flex gap-1 mt-2"
            role="toolbar"
            aria-label="Message actions"
          >
            {actionIcons.map(({ icon: Icon, type, action }) => (
              <button
                key={type}
                onClick={() => action(message.id)}
                title={`${type} message`}
                aria-label={`${type} message`}
                className="p-1.5 hover:bg-secondary dark:hover:bg-zinc-600 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {isUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />
        </motion.div>
      )}
    </div>
  );
}
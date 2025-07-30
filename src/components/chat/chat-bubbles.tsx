// components/chat/chat-bubble.tsx

import { ActionIconDefinition, Message, MessageFile, UserInfo } from '@/types/chat';
import { motion } from 'framer-motion';
import { JSX, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import StructuredContentRenderer from '../ui/structured-content-renderer'; // Assuming this component exists
import { FileRenderer } from './file-renderer'; // Import the FileRenderer component

interface ChatBubbleProps {
  message: Message;
  currentUser: UserInfo | undefined;
  botAvatarSrc?: string;
  botAvatarFallback?: string; // Optional fallback for bot avatar
  actionIcons: ActionIconDefinition[];
  onFileClick: (file: MessageFile) => void; // Handler for when a file is clicked
}

// A simple component for the blinking cursor during streaming
const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.8, repeat: Infinity }}
    className="inline-block w-px h-4 bg-current ml-0.5 align-bottom"
  />
);

export function ChatBubble({
  message,
  actionIcons,
  onFileClick,
}: ChatBubbleProps): JSX.Element {
  const isUser = message.sender === 'user';
  // A message has content if it has text OR structured content OR files
  const hasContent = message.message || message.structuredContent || (message.files && message.files.length > 0);

  // Effect to revoke blob URLs when the component unmounts or files change
  // This is important if you were creating blob URLs on the frontend for temporary previews.
  // Given your backend provides direct URLs, this might be less critical but good practice if any blob URLs are still generated.
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
  }, [message.files]); // Re-run if files array changes

  // Animation variants for the message bubble
  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  // Animation variants for the file attachments container
  const fileVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        delay: 0.1, // Slight delay after bubble appears
      },
    },
  };

  return (
    <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-start sm:justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col ${isUser ? 'items-start sm:items-end' : 'items-start'} w-full`}>
        {/* Message Bubble (for text and structured content) */}
        {/* Only render the bubble if there's text or structured content */}
        {(message.message || message.structuredContent) && (
          <motion.div
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            className={`px-3 py-2 md:px-4 md:py-2 rounded-2xl break-words text-sm md:text-base relative max-w-full ${
              isUser
                ? 'bg-primary text-primary-foreground dark:text-zinc-100'
                : 'bg-muted dark:bg-zinc-700 dark:text-zinc-200'
            } break-words overflow-wrap-break-word word-break-break-word`}
          >
            {message.error ? (
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-xs">⚠</span>
                <span className="italic text-red-500">{message.error}</span>
              </div>
            ) : (
              <div className="px-0.5 whitespace-pre-wrap">
                {/* Render Markdown text content */}
                <ReactMarkdown>{message.message}</ReactMarkdown>
                {/* Show blinking cursor if bot message is still streaming */}
                {message.sender === 'bot' && message.isStreaming && <BlinkingCursor />}
              </div>
            )}
            
            {/* Structured content rendering */}
            {message.structuredContent && (
              <div className={`${message.message ? 'mt-3 pt-3 border-t border-border/30' : ''}`}>
                <StructuredContentRenderer content={message.structuredContent} />
              </div>
            )}
          </motion.div>
        )}

        {/* File Attachments */}
        {/* Render files if they exist, regardless of text content */}
        {message.files && message.files.length > 0 && (
          <motion.div
            variants={fileVariants}
            initial="hidden"
            animate="visible"
            // Adjust grid columns based on number of files for better layout
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
                {/* Render each file using the FileRenderer component */}
                <FileRenderer file={file} onFileClick={onFileClick} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action Buttons for bot messages (copy, regenerate, like, dislike) */}
        {!isUser && !message.isStreaming && !message.error && actionIcons.length > 0 && (
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
    </div>
  );
}

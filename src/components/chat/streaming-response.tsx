'use client';

import { motion } from 'framer-motion';
import { Response } from '@/components/chat/response';
import { cn } from '@/lib/utils';

interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

// A simple component for the blinking cursor during streaming
const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.8, repeat: Infinity }}
    className="inline-block w-px h-4 bg-current ml-0.5 align-bottom"
  />
);

// Simple text renderer for streaming content
const StreamingTextRenderer = ({ content }: { content: string }) => {
  // Basic markdown-like formatting for streaming
  const formatStreamingContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted/50 px-1 py-0.5 rounded text-xs">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div 
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: formatStreamingContent(content) }}
    />
  );
};

export const StreamingResponse = ({ content, isStreaming, className }: StreamingResponseProps) => {
  // Debug logging
  console.log('StreamingResponse render:', { content: content.substring(0, 50) + '...', isStreaming, contentLength: content.length });
  
  return (
    <div className={cn("break-all overflow-wrap-anywhere min-w-0 overflow-hidden", className)}>
      {isStreaming ? (
        <StreamingTextRenderer content={content} />
      ) : (
        <Response>
          {content}
        </Response>
      )}
      {isStreaming && <BlinkingCursor />}
    </div>
  );
};

StreamingResponse.displayName = 'StreamingResponse';

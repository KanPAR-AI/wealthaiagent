'use client';

import { motion } from 'framer-motion';
import { Response } from '@/components/chat/response';
import { cn } from '@/lib/utils';

interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

// Blinking cursor during streaming
const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.8, repeat: Infinity }}
    className="inline-block w-px h-4 bg-current ml-0.5 align-bottom"
  />
);

/** Collapse 3+ consecutive newlines to max 2 */
function cleanContent(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * Render markdown table lines (|...|) as actual HTML <table>.
 * Non-table lines get basic inline markdown formatting.
 */
function formatStreamingContent(text: string): string {
  const cleaned = cleanContent(text);
  const lines = cleaned.split('\n');
  const result: string[] = [];
  let inTable = false;
  let isHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table rows: lines starting and ending with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator row (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }

      const cells = trimmed
        .slice(1, -1) // remove leading/trailing |
        .split('|')
        .map(c => c.trim());

      if (!inTable) {
        result.push('<div class="rounded-md border overflow-x-auto my-3">');
        result.push('<table class="w-full" style="font-size:11px">');
        inTable = true;
        isHeader = true;
      }

      if (isHeader) {
        result.push('<thead class="bg-muted/50"><tr>');
        for (const cell of cells) {
          result.push(`<th style="padding:2px 6px;text-align:left;font-weight:500;white-space:nowrap;opacity:0.7">${formatInline(cell)}</th>`);
        }
        result.push('</tr></thead><tbody>');
        isHeader = false;
      } else {
        result.push('<tr style="border-bottom:1px solid var(--border)">');
        for (const cell of cells) {
          result.push(`<td style="padding:2px 6px;white-space:nowrap">${formatInline(cell)}</td>`);
        }
        result.push('</tr>');
      }
    } else {
      // Close table if we were in one
      if (inTable) {
        result.push('</tbody></table></div>');
        inTable = false;
        isHeader = true;
      }

      // Regular line — apply inline markdown
      if (trimmed === '') {
        result.push('<br/>');
      } else {
        result.push(formatInline(line) + '<br/>');
      }
    }
  }

  // Close unclosed table (streaming may end mid-table)
  if (inTable) {
    result.push('</tbody></table></div>');
  }

  return result.join('');
}

/** Format inline markdown: bold, italic, code */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted/50 px-1 py-0.5 rounded text-xs">$1</code>');
}

// Streaming text renderer with table support
const StreamingTextRenderer = ({ content }: { content: string }) => (
  <div
    className="prose prose-sm max-w-none"
    dangerouslySetInnerHTML={{ __html: formatStreamingContent(content) }}
  />
);

export const StreamingResponse = ({ content, isStreaming, className }: StreamingResponseProps) => {
  return (
    <div className={cn("break-words overflow-wrap-anywhere min-w-0 overflow-x-auto", className)}>
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

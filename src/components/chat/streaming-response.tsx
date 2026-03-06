'use client';

import { motion } from 'framer-motion';
import { Response } from '@/components/chat/response';
import { cn } from '@/lib/utils';

interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  className?: string;
  onNavigate?: (path: string) => void;
}

// Blinking cursor during streaming
const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.8, repeat: Infinity }}
    className="inline-block w-px h-4 bg-current ml-0.5 align-bottom"
  />
);

/** Collapse excessive blank lines (including lines with only whitespace) to max one blank line */
function cleanContent(text: string): string {
  return text
    .replace(/(\n[ \t]*){3,}/g, '\n\n')  // 3+ newlines (with optional whitespace) → 2
    .replace(/^\n+/, '');                  // strip leading newlines
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

/**
 * Convert a YouTube markdown link to an embedded iframe (web) or
 * a clickable thumbnail (native — iframes don't work in WKWebView).
 * Matches: [title](https://www.youtube.com/watch?v=ID&t=SS)
 */
function youtubeMarkdownToEmbed(text: string): string {
  const native = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
  return text.replace(
    /\[([^\]]*)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]*v=([a-zA-Z0-9_-]+)[^\s)]*|youtu\.be\/([a-zA-Z0-9_-]+)[^\s)]*))\)/g,
    (_match, title, fullUrl, vidId1, vidId2) => {
      const videoId = vidId1 || vidId2;
      if (!videoId) return _match;

      if (native) {
        // Native: show thumbnail that opens YouTube app / Safari
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        return (
          `<div class="youtube-embed my-3">` +
          `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;">` +
          `<img src="${thumbUrl}" alt="${title}" style="width:100%;border-radius:8px;" />` +
          `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;background:rgba(0,0,0,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;">` +
          `<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>` +
          `</div>` +
          `</a>` +
          `<div class="youtube-embed-caption"><a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>` +
          `</div>`
        );
      }

      // Web: use iframe embed
      const timeMatch = fullUrl.match(/[?&]t=(\d+)/);
      const start = timeMatch ? timeMatch[1] : '0';
      const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&rel=0`;
      return (
        `<div class="youtube-embed my-3">` +
        `<iframe src="${embedUrl}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` +
        `<div class="youtube-embed-caption"><a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>` +
        `</div>`
      );
    }
  );
}

/** Format inline markdown: bold, italic, code, YouTube embeds */
function formatInline(text: string): string {
  // First handle YouTube markdown links before other formatting
  const withEmbeds = youtubeMarkdownToEmbed(text);
  // If we replaced a YouTube link, don't apply further inline formatting to that chunk
  if (withEmbeds !== text) return withEmbeds;
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

export const StreamingResponse = ({ content, isStreaming, className, onNavigate }: StreamingResponseProps) => {
  return (
    <div className={cn("break-words overflow-wrap-anywhere min-w-0 overflow-x-auto", className)}>
      {isStreaming ? (
        <StreamingTextRenderer content={content} />
      ) : (
        <Response onNavigate={onNavigate}>
          {content}
        </Response>
      )}
      {isStreaming && <BlinkingCursor />}
    </div>
  );
};

StreamingResponse.displayName = 'StreamingResponse';

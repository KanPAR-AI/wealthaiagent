'use client';

import { cn } from '@/lib/utils';
import { memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResponseProps {
  children?: string;
  className?: string;
}

/** Collapse excessive blank lines to max one blank line */
function cleanContent(text: string): string {
  return text
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

/**
 * Extract YouTube video ID and start time from a URL.
 * Returns null if the URL is not a YouTube video link.
 */
function parseYouTubeUrl(href: string): { videoId: string; start: number } | null {
  try {
    const url = new URL(href);
    // youtube.com/watch?v=ID or youtu.be/ID
    let videoId: string | null = null;
    if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else if (url.hostname === 'youtu.be') {
      videoId = url.pathname.slice(1);
    }
    if (!videoId) return null;

    const start = parseInt(url.searchParams.get('t') || '0', 10) || 0;
    return { videoId, start };
  } catch {
    return null;
  }
}

/** Custom components for styled markdown rendering */
const mdComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="rounded-md border overflow-x-auto my-3">
      <table className="w-full text-[11px] sm:text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/50" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="h-7 sm:h-10 px-1.5 sm:px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-1.5 sm:px-3 py-1 sm:py-2 align-middle border-b whitespace-nowrap" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="border-b transition-colors hover:bg-muted/50" {...props}>{children}</tr>
  ),
  // Tighten paragraph spacing
  p: ({ children, ...props }) => (
    <p className="my-1" {...props}>{children}</p>
  ),
  // YouTube links → embedded iframe player
  a: ({ href, children, ...props }) => {
    if (!href) return <a {...props}>{children}</a>;
    const yt = parseYouTubeUrl(href);
    if (yt) {
      const embedUrl = `https://www.youtube.com/embed/${yt.videoId}?start=${yt.start}&rel=0`;
      return (
        <div className="youtube-embed my-3">
          <iframe
            src={embedUrl}
            title={typeof children === 'string' ? children : 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className="youtube-embed-caption">
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          </div>
        </div>
      );
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  },
};

export const Response = memo(
  ({ className, children }: ResponseProps) => {
    const cleaned = typeof children === 'string' ? cleanContent(children) : (children ?? '');
    return (
      <div className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {cleaned}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';

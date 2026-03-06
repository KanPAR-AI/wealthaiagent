'use client';

import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface ResponseProps {
  children?: string;
  className?: string;
  onNavigate?: (path: string) => void;
}

/** Collapse excessive blank lines to max one blank line */
function cleanContent(text: string): string {
  return text
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

/**
 * Pre-process markdown to convert YouTube links to embedded iframe HTML.
 *
 * Converts patterns like:
 *   **Watch:** [Title](https://www.youtube.com/watch?v=ID&t=36)
 *   [Title](https://youtube.com/watch?v=ID)
 *
 * Into raw HTML <div> blocks that rehype-raw will render as block elements
 * (avoiding the invalid div-inside-p nesting problem).
 */
function embedYouTubeLinks(text: string): string {
  return text.replace(
    /^(.*?)\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]*v=([a-zA-Z0-9_-]+)[^\s)]*|youtu\.be\/([a-zA-Z0-9_-]+)[^\s)]*?))\)(.*)$/gm,
    (_match, before, title, fullUrl, vidId1, vidId2, after) => {
      const videoId = vidId1 || vidId2;
      if (!videoId) return _match;
      const timeMatch = fullUrl.match(/[?&]t=(\d+)/);
      const start = timeMatch ? timeMatch[1] : '0';
      const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&rel=0`;
      const prefix = before.trim() ? before.trim() + '\n\n' : '';
      const suffix = after.trim() ? '\n\n' + after.trim() : '';
      return (
        `${prefix}<div class="youtube-embed my-3">` +
        `<iframe src="${embedUrl}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` +
        `<div class="youtube-embed-caption"><a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>` +
        `</div>${suffix}`
      );
    }
  );
}

/** Check if a URL is an internal app link (starts with / and matches known routes) */
function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;
  return /^\/(?:mealplan|chat|admin|trade|debug|logs)(?:\/|$)/.test(href);
}

/** Build markdown components, injecting an optional navigate handler for internal links */
function buildMdComponents(onNavigate?: (path: string) => void): Components {
  return {
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
    // Internal links use client-side navigation; external links open in new tab
    a: ({ href, children, ...props }) => {
      if (isInternalLink(href) && onNavigate) {
        return (
          <a
            href={href}
            onClick={(e) => { e.preventDefault(); onNavigate(href!); }}
            className="text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
      );
    },
  };
}

export const Response = memo(
  ({ className, children, onNavigate }: ResponseProps) => {
    const raw = typeof children === 'string' ? children : (children ?? '');
    const cleaned = cleanContent(raw);
    const withEmbeds = embedYouTubeLinks(cleaned);
    const mdComponents = buildMdComponents(onNavigate);
    return (
      <div className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={mdComponents}
        >
          {withEmbeds}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children && prevProps.onNavigate === nextProps.onNavigate,
);

Response.displayName = 'Response';

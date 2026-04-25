'use client';

import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { BedtimeVideoWidget, tryParseBedtimePayload } from '@/components/widgets/bedtime-video-widget';
import { PalmReadingWidget, tryParsePalmPayload } from '@/components/widgets/palm-reading-widget';
import { PalmScanningWidget, tryParsePalmScanningPayload } from '@/components/widgets/palm-scanning-widget';

interface ResponseProps {
  children?: string;
  className?: string;
  onNavigate?: (path: string) => void;
}

/** Collapse excessive blank lines to max one blank line */
function cleanContent(text: string): string {
  return text
    // Strip "[Using X agent]" prefix — internal routing info, not user-facing
    .replace(/^\[Using \w+ agent\]\s*/i, '')
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

/**
 * Pre-process markdown to convert YouTube links to embedded iframe HTML.
 *
 * Consolidates multiple references to the same video into a single
 * embedded player so the response doesn't show 3 identical iframes
 * when 3 corpus chunks from the same video are cited.
 */
function embedYouTubeLinks(text: string): string {
  // First pass: collect all YouTube links and group by video ID
  const ytPattern =
    /^(.*?)\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]*v=([a-zA-Z0-9_-]+)[^\s)]*|youtu\.be\/([a-zA-Z0-9_-]+)[^\s)]*?))\)(.*)$/gm;

  const seenVideos = new Set<string>();
  return text.replace(ytPattern, (_match, before, title, fullUrl, vidId1, vidId2, after) => {
    const videoId = vidId1 || vidId2;
    if (!videoId) return _match;

    // Skip duplicate embeds for the same video — show only the first
    if (seenVideos.has(videoId)) {
      // Keep the surrounding text but replace the link with a plain text ref
      const prefix = before.trim() ? before.trim() + ' ' : '';
      const suffix = after.trim() ? ' ' + after.trim() : '';
      return `${prefix}*(see video above)*${suffix}`;
    }
    seenVideos.add(videoId);

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
  });
}

/** Check if a URL is an internal app link (starts with / and matches known routes) */
function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;
  return /^\/(?:mealplan|chat|admin|trade|debug|logs)(?:\/|$)/.test(href);
}

/** Build markdown components, injecting an optional navigate handler for internal links */
function buildMdComponents(onNavigate?: (path: string) => void): Components {
  return {
    // Intercept fenced ```bedtime_video {...}``` blocks and render the
    // interactive widget. Any other fenced code block falls through to the
    // default <code> rendering.
    code: ({ className, children, ...props }: any) => {
      const lang = /language-(\w+)/.exec(className || "")?.[1];
      const raw = String(children ?? "").trim();

      if (lang === "bedtime_video") {
        const payload = tryParseBedtimePayload(raw);
        if (payload) return <BedtimeVideoWidget payload={payload} />;
      }

      // Cinematic scanning placeholder while Gemini Vision is running.
      if (lang === "palm_scanning") {
        const payload = tryParsePalmScanningPayload(raw);
        if (payload) return <PalmScanningWidget payload={payload} />;
        return null;
      }

      // Render palm_analysis as the visual PalmReadingWidget (image + neon
      // line overlay + viral prediction chips). If parsing fails for any
      // reason, fall back to hiding the raw JSON.
      if (lang === "palm_analysis") {
        const payload = tryParsePalmPayload(raw);
        if (payload) return <PalmReadingWidget payload={payload} />;
        return null;
      }

      // Hide muhurta_results, natal_chart JSON blocks for now (rendered as
      // formatted markdown below the block; raw JSON is noise).
      if (lang && ["muhurta_results", "natal_chart"].includes(lang)) {
        return null;
      }

      // Default: inline code or unknown language — let react-markdown do its thing.
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
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

'use client';

import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { embedCorpusMediaLinks, embedYouTubeLinks } from './embed-links';

import { renderCodeBlock } from './block-registry';

interface ResponseProps {
  children?: string;
  className?: string;
  onNavigate?: (path: string) => void;
  // When false (history reload), suppress streaming-only placeholder widgets
  // like palm_scanning that would otherwise loop their "Compiling reading…"
  // animation forever on a saved message.
  isStreaming?: boolean;
}

/** Collapse excessive blank lines to max one blank line */
function cleanContent(text: string): string {
  return text
    // Strip "[Using X agent]" prefix — internal routing info, not user-facing
    .replace(/^\[Using \w+ agent\]\s*/i, '')
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

/** Check if a URL is an internal app link (starts with / and matches known routes) */
function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;
  return /^\/(?:mealplan|chat|admin|trade|debug|logs)(?:\/|$)/.test(href);
}

/** Build markdown components, injecting an optional navigate handler for internal links */
function buildMdComponents(
  onNavigate?: (path: string) => void,
  isStreaming = true,
): Components {
  return {
    // Fenced data blocks go through the registry (docs/49 ASTRAL-20). The
    // three astrology blocks used to be a hardcoded `return null` here, with
    // a comment claiming the prose below covered them. It did not: the server
    // computed a chart, a match scorecard and a muhurta table, and the client
    // threw all three away. An unregistered data block now renders nothing
    // AND says so once, by name, so the next one is visible in a session
    // rather than in a quarterly audit.
    code: ({ className, children, ...props }: any) => {
      const lang = /language-(\w+)/.exec(className || "")?.[1];
      const raw = String(children ?? "").trim();

      const outcome = renderCodeBlock(lang, raw, { isStreaming });
      if (outcome.handled) return outcome.node;

      // Ordinary inline code or an unknown non-data language — let
      // react-markdown do its thing.
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
      // External links were rendered with NO class. Tailwind's preflight resets
      // `a` to inherit colour and drop the underline, so an agent reply like
      // "[Download the unlocked PDF](…)" looked like ordinary prose — clickable
      // with nothing to say so. Style them the same as internal links.
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          {...props}
        >
          {children}
        </a>
      );
    },
  };
}

/** The Hindi/English audio toggle on inline corpus players (docs/44 CORP-29).
 *
 *  The player is raw markdown HTML, so it cannot carry React handlers — the
 *  toggle is a data-attributed button and this delegated handler does the
 *  swap: capture position → swap src → restore position → resume. Videos
 *  without a stamped Hindi track render no button and never reach here. */
function handleDubToggle(e: React.MouseEvent) {
  const btn = (e.target as HTMLElement).closest?.('[data-dub-toggle]');
  if (!btn) return;
  const video = btn.closest('.youtube-embed')?.querySelector('video');
  if (!video) return;
  e.preventDefault();
  const next = btn.getAttribute('data-active') === 'hi' ? 'en' : 'hi';
  const src = btn.getAttribute(next === 'hi' ? 'data-src-hi' : 'data-src-en');
  if (!src) return;
  const at = video.currentTime;
  const wasPlaying = !video.paused;
  video.addEventListener(
    'loadedmetadata',
    () => {
      video.currentTime = at;
      if (wasPlaying) void video.play();
    },
    { once: true },
  );
  video.src = src;
  video.load();
  btn.setAttribute('data-active', next);
  btn.textContent = next === 'hi' ? 'English' : 'हिन्दी';
}

export const Response = memo(
  ({ className, children, onNavigate, isStreaming = true }: ResponseProps) => {
    const raw = typeof children === 'string' ? children : (children ?? '');
    const cleaned = cleanContent(raw);
    const withEmbeds = embedCorpusMediaLinks(embedYouTubeLinks(cleaned));
    const mdComponents = buildMdComponents(onNavigate, isStreaming);
    return (
      <div
        className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
        onClick={handleDubToggle}
      >
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
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.onNavigate === nextProps.onNavigate &&
    prevProps.isStreaming === nextProps.isStreaming,
);

Response.displayName = 'Response';

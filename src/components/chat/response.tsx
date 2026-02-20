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

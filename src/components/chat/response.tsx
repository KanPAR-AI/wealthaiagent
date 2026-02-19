'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, type HTMLAttributes } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown>;

/** Collapse 3+ consecutive newlines to max 2 (one visual blank line) */
function cleanContent(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    const cleaned = typeof children === 'string' ? cleanContent(children) : children;
    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className,
        )}
        components={{
          table: ({ className: cls, ...p }: HTMLAttributes<HTMLTableElement>) => (
            <div className="rounded-md border overflow-x-auto my-3">
              <table className={cn('w-full text-[11px] sm:text-sm', cls)} {...p} />
            </div>
          ),
          thead: (p: HTMLAttributes<HTMLTableSectionElement>) => (
            <thead className="bg-muted/50" {...p} />
          ),
          th: ({ className: cls, ...p }: HTMLAttributes<HTMLTableCellElement>) => (
            <th className={cn('h-7 sm:h-10 px-1.5 sm:px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap', cls)} {...p} />
          ),
          td: ({ className: cls, ...p }: HTMLAttributes<HTMLTableCellElement>) => (
            <td className={cn('px-1.5 sm:px-3 py-1 sm:py-2 align-middle border-b whitespace-nowrap', cls)} {...p} />
          ),
          tr: ({ className: cls, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
            <tr className={cn('border-b transition-colors hover:bg-muted/50', cls)} {...p} />
          ),
        }}
        {...props}
      >
        {cleaned}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';

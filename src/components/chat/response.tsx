'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => {
    console.log('[Response] Rendering with content:', typeof props.children === 'string' ? props.children?.substring(0, 50) + '...' : 'N/A');
    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className,
        )}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => {
    const shouldSkip = prevProps.children === nextProps.children;
    console.log('[Response] Memo check - shouldSkip:', shouldSkip, 'prev:', typeof prevProps.children, 'next:', typeof nextProps.children);
    return shouldSkip;
  },
);

Response.displayName = 'Response';

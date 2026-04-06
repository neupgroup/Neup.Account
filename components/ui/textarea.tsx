
"use client";

import * as React from 'react';
import { cn } from '@/core/helpers/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, onChange, ...props }, ref) => {
  const localRef = React.useRef<HTMLTextAreaElement>(null);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (localRef.current) {
      localRef.current.style.height = 'auto';
      localRef.current.style.height = `${localRef.current.scrollHeight}px`;
    }
    if (onChange) {
      onChange(event);
    }
  };
  
  React.useImperativeHandle(ref, () => localRef.current!);

  React.useEffect(() => {
    if (localRef.current) {
      localRef.current.style.height = 'auto';
      localRef.current.style.height = `${localRef.current.scrollHeight}px`;
    }
  }, [props.value]);


  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-y-hidden',
        className
      )}
      ref={localRef}
      onInput={handleInput}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };

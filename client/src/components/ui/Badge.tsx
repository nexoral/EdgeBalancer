import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-all border',
        {
          'border-transparent bg-[var(--accent)] text-white shadow-xs': variant === 'default',
          'border-[var(--line)] bg-[var(--bg-2)] text-[var(--text-2)]': variant === 'secondary',
          'border-[rgba(52,199,89,0.25)] bg-[var(--green-dim)] text-[var(--green)]': variant === 'success',
          'border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.12)] text-[var(--red)]': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  );
}

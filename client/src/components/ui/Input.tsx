import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-2 text-sm text-[var(--text)] transition-all duration-150 placeholder:text-[var(--text-3)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dim)] focus-visible:bg-[var(--bg-1)] disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[var(--red)] focus-visible:border-[var(--red)] focus-visible:ring-[rgba(255,59,48,0.15)]',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs font-medium text-[var(--red)]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };

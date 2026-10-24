import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
          {
            'bg-[var(--accent)] text-white hover:brightness-105 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.25)] border border-[var(--accent-2)]': variant === 'default',
            'bg-[var(--bg-2)] text-[var(--text)] hover:bg-[var(--bg-3)] border border-[var(--line)] shadow-sm': variant === 'secondary',
            'border border-[var(--line)] bg-[var(--glass)] backdrop-blur-md text-[var(--text)] hover:bg-[var(--bg-2)] hover:border-[var(--line-2)] shadow-sm': variant === 'outline',
            'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]': variant === 'ghost',
            'bg-[var(--red)] text-white hover:brightness-105 shadow-[0_1px_2px_rgba(0,0,0,0.1)]': variant === 'destructive',
          },
          {
            'h-10 py-2 px-4 text-sm rounded-xl': size === 'default',
            'h-8 px-3 text-xs rounded-lg': size === 'sm',
            'h-12 px-7 text-base rounded-2xl': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

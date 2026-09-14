import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        {
          'bg-cardHover text-textSub border-subtle': variant === 'default',
          'bg-emeraldMain/10 text-emerald-400 border-emeraldMain/20': variant === 'success',
          'bg-warning/10 text-warning border-warning/20': variant === 'warning',
          'bg-danger/10 text-danger border-danger/20': variant === 'danger',
          'bg-blue-500/10 text-blue-400 border-blue-500/20': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

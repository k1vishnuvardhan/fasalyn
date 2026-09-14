import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center bg-cardHover rounded-xl border border-subtle/50', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card mb-4 shadow-inner shadow-black/20">
        <Icon className="h-8 w-8 text-emeraldMain opacity-80" />
      </div>
      <h3 className="text-lg font-semibold text-textMain">{title}</h3>
      {description && <p className="text-textSub mt-2 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

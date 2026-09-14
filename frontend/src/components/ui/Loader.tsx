import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Loader({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center justify-center p-4', className)}>
      <Loader2 className="animate-spin text-emeraldMain" size={size} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-t-2 border-emeraldMain animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-r-2 border-emerald-400 animate-spin direction-reverse"></div>
        </div>
        <p className="text-textSub animate-pulse">Loading Fasalyn...</p>
      </div>
    </div>
  );
}

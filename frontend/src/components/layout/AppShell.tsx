import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';

export function AppShell() {
  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-textMain selection:bg-emeraldMain/20">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
        <Topbar />
        
        {/* Main scrollable content area */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pb-24 sm:p-6 md:pb-6 scroll-smooth">
          <div className="max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  );
}

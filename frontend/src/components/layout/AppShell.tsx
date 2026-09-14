import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { useI18n } from '../../i18n/I18nProvider';

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { t } = useI18n();
  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-textMain selection:bg-emeraldMain/20">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
        
        {/* Prototype Warning Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm text-amber-500/90 z-30 relative shadow-sm shrink-0">
          <span className="shrink-0 text-amber-500">⚠️</span>
          <span><strong className="text-amber-500 font-semibold">{t('prototypeNoticeTitle')}:</strong> {t('prototypeNoticeText')}</span>
        </div>
        
        {/* Main scrollable content area */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pb-24 sm:p-6 md:pb-6 scroll-smooth">
          <div className="max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

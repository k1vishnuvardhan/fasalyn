import React from 'react';
import { cn } from '../../lib/utils';
import { Bell, Languages, Search, User as UserIcon } from 'lucide-react';
import { Input } from '../ui/Input';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../i18n/I18nProvider';

export function Topbar() {
  const user = useAuthStore((state) => state.user);
  const { language, setLanguage, t } = useI18n();
  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur-sm border-b border-subtle z-40 sticky top-0">
      
      {/* Mobile Title */}
      <div className="md:hidden flex items-center gap-2">
        <span className="text-base font-semibold tracking-[.12em] text-textMain">FASALYN</span>
      </div>

      {/* Global Search (Hidden on Mobile) */}
      <div className="hidden md:flex items-center w-full max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
        <Input 
          type="search" 
          placeholder={t('searchFarms')}
          className="pl-9 bg-card border-none focus-visible:ring-1" 
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 ml-auto">
        <label className="hidden sm:flex items-center gap-2 rounded-lg border border-subtle bg-card px-2 py-1.5 text-sm text-textSub" title={t('preferredLanguage')}>
          <Languages className="h-4 w-4 text-emeraldMain" />
          <span className="sr-only">{t('preferredLanguage')}</span>
          <select aria-label={t('preferredLanguage')} className="bg-transparent text-textMain outline-none" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
            <option value="hi">हिन्दी</option>
          </select>
        </label>
        <button className="relative p-2 text-textSub hover:text-textMain transition-colors rounded-full hover:bg-cardHover">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
        </button>
        
        <div className="h-8 w-px bg-subtle mx-1 hidden md:block" />
        
        <button className="flex items-center gap-2 hover:bg-cardHover p-1.5 rounded-full md:rounded-lg transition-colors">
          <div className="h-8 w-8 rounded-full bg-emeraldMain/20 flex items-center justify-center text-emerald-400 border border-emeraldMain/30">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="hidden md:flex flex-col items-start mr-2">
            <span className="text-sm font-medium leading-none text-textMain">{user?.name || t('account')}</span>
            <span className="text-xs text-textMuted mt-1">{user?.role === 'OFFICER' ? t('agricultureOfficer') : t('farmOwner')}</span>
          </div>
        </button>
      </div>
    </header>
  );
}

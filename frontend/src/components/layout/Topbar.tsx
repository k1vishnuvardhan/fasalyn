import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Bell, Languages, Search, User as UserIcon, Menu, LogOut, Info } from 'lucide-react';
import { Input } from '../ui/Input';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../i18n/I18nProvider';
import { useNavigate } from 'react-router-dom';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur-sm border-b border-subtle z-[9995] sticky top-0">
      
      {/* Mobile Title */}
      <div className="md:hidden flex items-center gap-3">
        <button onClick={onMenuClick} className="p-1 -ml-1 text-textSub hover:text-textMain"><Menu size={24} /></button>
        <span className="text-base font-semibold tracking-[.12em] text-textMain">FASALYN</span>
      </div>

      {/* Global Search (Hidden on Mobile) */}
      <div className="hidden md:flex items-center w-full max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
        <Input type="search" placeholder={t('searchFarms')} className="pl-9 bg-card border-none focus-visible:ring-1" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-4 ml-auto relative">
        <label className="flex items-center gap-1 sm:gap-2 rounded-lg border border-subtle bg-card px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-textSub cursor-pointer hover:bg-cardHover transition-colors" title={t('preferredLanguage')}>
          <Languages className="h-4 w-4 text-emeraldMain shrink-0" />
          <span className="sr-only">{t('preferredLanguage')}</span>
          <select aria-label={t('preferredLanguage')} className="bg-transparent text-textMain outline-none cursor-pointer" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
            <option value="hi">हिन्दी</option>
          </select>
        </label>
        
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }} className="relative p-2 text-textSub hover:text-textMain transition-colors rounded-full hover:bg-cardHover">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-subtle rounded-xl shadow-xl py-2 z-[9999]">
              <div className="px-4 py-2 border-b border-subtle font-medium">Notifications</div>
              <div className="px-4 py-3 text-sm flex gap-3 hover:bg-cardHover cursor-pointer">
                <Info className="h-4 w-4 text-emeraldMain shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Scan completed</div>
                  <div className="text-textMuted text-xs">Your cotton plot scan finished with no critical issues.</div>
                </div>
              </div>
              <div className="px-4 py-3 text-sm flex gap-3 hover:bg-cardHover cursor-pointer border-t border-subtle">
                <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Officer follow-up required</div>
                  <div className="text-textMuted text-xs">An agriculture officer has requested an updated photo.</div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-px bg-subtle mx-1 hidden md:block" />
        
        {/* User Profile */}
        <div className="relative">
          <button onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }} className="flex items-center gap-2 hover:bg-cardHover p-1.5 rounded-full md:rounded-lg transition-colors">
            <div className="h-8 w-8 rounded-full bg-emeraldMain/20 flex items-center justify-center text-emerald-400 border border-emeraldMain/30">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="hidden md:flex flex-col items-start mr-2">
              <span className="text-sm font-medium leading-none text-textMain">{user?.name || t('account')}</span>
              <span className="text-xs text-textMuted mt-1">{user?.role === 'OFFICER' ? t('agricultureOfficer') : t('farmOwner')}</span>
            </div>
          </button>
          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-subtle rounded-xl shadow-xl py-2 z-[9999]">
              <div className="px-4 py-2 border-b border-subtle mb-1">
                <div className="font-medium">{user?.name || 'User'}</div>
                <div className="text-xs text-textMuted">{user?.email || 'user@example.com'}</div>
              </div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-cardHover flex items-center gap-2 transition-colors">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>

      </div>
      
      {/* Click outside overlay to close dropdowns */}
      {(showProfile || showNotifs) && (
        <div className="fixed inset-0 z-[9990]" onClick={() => { setShowProfile(false); setShowNotifs(false); }} />
      )}
    </header>
  );
}

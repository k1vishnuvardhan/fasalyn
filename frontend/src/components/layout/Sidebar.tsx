import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { 
  Home, 
  Map as MapIcon, 
  Scan, 
  AlertTriangle, 
  Bug, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Sprout,
  ClipboardCheck,
  BookOpen,
  MessageSquare,
  Activity
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../i18n/I18nProvider';

const FARMER_NAV_ITEMS = [
  { icon: Home, labelKey: 'dashboard', path: '/' },
  { icon: MapIcon, labelKey: 'mapMyFarm', path: '/map' },
  { icon: Scan, labelKey: 'scanner', path: '/scanner' },
  { icon: AlertTriangle, labelKey: 'riskForecast', path: '/risk' },
  { icon: Activity, labelKey: 'regionalHotspots', path: '/hotspots' },
  { icon: AlertTriangle, labelKey: 'alerts', path: '/alerts' },
  { icon: Bug, labelKey: 'pestMonitoring', path: '/pests' },
  { icon: BookOpen, labelKey: 'knowledgeCenter', path: '/knowledge' },
  { icon: MessageSquare, labelKey: 'aiAssistant', path: '/assistant' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();
  const navItems = user?.role === 'OFFICER' ? [{ icon: ClipboardCheck, labelKey: 'officerDesk', path: '/officer' }] : FARMER_NAV_ITEMS;

  return (
    <aside 
      className={cn(
        'hidden md:flex flex-col bg-sidebar text-[#e8e4db] transition-all duration-300 relative h-screen z-20 border-r border-[#152e21]',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center px-4 border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden text-[#a8d5b7]">
          <Sprout className="h-8 w-8 flex-shrink-0" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-[.12em] text-white whitespace-nowrap">
              FASALYN
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links (Scrollable) */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group',
                isActive ? 'bg-black/20 text-[#fdfbf7] font-medium shadow-inner' : 'text-[#e8e4db]/80 hover:bg-black/10 hover:text-[#fdfbf7]'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{t(item.labelKey)}</span>}
            
            {/* Tooltip for collapsed state */}
            {collapsed && (
              <div className="absolute left-20 bg-[#10271e] border border-white/10 text-white px-2 py-1 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                {t(item.labelKey)}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-white/10">
        <NavLink
          to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors',
                isActive ? 'bg-black/20 text-[#fdfbf7] shadow-inner' : 'text-[#e8e4db]/80 hover:bg-black/10 hover:text-[#fdfbf7]'
              )
            }
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{t('settings')}</span>}
        </NavLink>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-card border border-subtle rounded-full p-1 text-textSub hover:text-textMain hover:bg-cardHover shadow-sm transition-all z-10"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}

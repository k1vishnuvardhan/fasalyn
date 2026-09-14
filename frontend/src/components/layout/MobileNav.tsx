import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Home, Map as MapIcon, Scan, AlertTriangle, Settings, ClipboardCheck, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../i18n/I18nProvider';

const FARMER_NAV_ITEMS = [
  { icon: Home, labelKey: 'dashboard', path: '/' },
  { icon: MapIcon, labelKey: 'mapMyFarm', path: '/map' },
  { icon: Scan, labelKey: 'scanner', path: '/scanner' },
  { icon: Activity, labelKey: 'regionalHotspots', path: '/hotspots' },
  { icon: Settings, labelKey: 'settings', path: '/settings' },
];

export function MobileNav() {
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();
  const navItems = user?.role === 'OFFICER' ? [{ icon: ClipboardCheck, labelKey: 'officerDesk', path: '/officer' }, { icon: Activity, labelKey: 'regionalHotspots', path: '/hotspots' }] : FARMER_NAV_ITEMS;
  return (
    <nav aria-label="Main navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-white/10 pb-safe z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-16 h-12 rounded-lg transition-colors',
                isActive ? 'text-white' : 'text-white/65 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'p-1 rounded-full transition-all duration-300',
                  isActive ? 'bg-white/12' : 'bg-transparent'
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium mt-1">{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18nContext';
import { ROLE_I18N_KEYS, type UserRole } from '@/types/pos';
import { LayoutDashboard, Package, ShoppingCart, FileText, Users, BarChart3, Settings, LogOut, Truck, Receipt, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { path: '/products', labelKey: 'nav.products', icon: Package, permission: 'products' },
  { path: '/inventory', labelKey: 'nav.inventory', icon: Boxes, permission: 'inventory' },
  { path: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'pos' },
  { path: '/transactions', labelKey: 'nav.transactions', icon: FileText, permission: 'transactions' },
  { path: '/customers', labelKey: 'nav.customers', icon: Users, permission: 'customers' },
  { path: '/suppliers', labelKey: 'nav.suppliers', icon: Truck, permission: 'suppliers' },
  { path: '/expenses', labelKey: 'nav.expenses', icon: Receipt, permission: 'expenses' },
  { path: '/reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'reports' },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { t, isRTL } = useI18n();

  const visibleNav = navItems.filter(item => hasPermission(item.permission));

  return (
    <div className={`flex h-screen overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Sidebar */}
      <aside className={`w-64 bg-sidebar flex flex-col shrink-0 ${isRTL ? 'order-last' : ''}`}>
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
            <img src="./logo.png" alt="RIC Library" className="w-10 h-10 object-contain" />
            {t('app.title')}
          </h1>
          <p className="text-xs text-sidebar-muted mt-1">{t('app.subtitle')}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map(({ path, labelKey, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <Icon size={18} />
                {t(labelKey)}
                {active && (
                  <div className={`${isRTL ? 'mr-auto' : 'ml-auto'} w-1.5 h-1.5 rounded-full bg-sidebar-primary`} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-xs font-semibold">
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-sidebar-muted">{user?.role ? t(ROLE_I18N_KEYS[user.role as UserRole]) : 'Guest'}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={logout}
              title={t('auth.logout')}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
